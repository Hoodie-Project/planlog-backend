import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TourApiService } from '../tour-api/tour-api.service';
import { TourRawItem } from '../tour-api/tour-api.types';
import { CreateStampDto } from './dto/create-stamp.dto';
import { Zone, ZONE_META } from '../common/gangwon.constants';
import { Mood } from '../common/mood.constants';
import { haversineMeters, toLatLng } from '../common/geo';
import type { User } from '../../generated/prisma/client.js';

const ALL_ZONES = Object.values(Zone);
const STAMP_MAX_DISTANCE_METERS = 2000;

export type StampSortOrder = 'asc' | 'desc';

/** 스탬프 버튼 상태 — Figma "위치/권한 별 스탬프 활성화" 5states */
export enum StampEligibilityState {
  ALREADY_STAMPED = 'ALREADY_STAMPED', // 스탬프 수령 완료
  REVIEWER = 'REVIEWER', // 심사자(게스트) — 위치 무관 항상 활성화
  NO_LOCATION = 'NO_LOCATION', // 위치 권한 미허용 — 비활성화
  TOO_FAR = 'TOO_FAR', // 2km 밖 — 비활성화
  ELIGIBLE = 'ELIGIBLE', // 2km 이내 — 활성화
}

export interface StampEligibility {
  state: StampEligibilityState;
  /** 비활성화 사유 한 줄(활성 상태거나 사유가 필요 없으면 null) */
  reason: string | null;
  /** 현재 위치 기준 거리(m). 계산됐을 때만 포함 */
  distance?: number;
}

@Injectable()
export class StampService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tourApi: TourApiService,
  ) {}

  /**
   * 관광지 방문 인증 → 스탬프 획득(같은 관광지는 1회만, 멱등).
   * 위치/권한 조건을 만족해야 함(checkEligibility) — 심사자(게스트)는 예외.
   */
  async create(user: User, dto: CreateStampDto) {
    const eligibility = await this.checkEligibility(
      user,
      dto.contentId,
      dto.curMapX,
      dto.curMapY,
    );
    if (
      eligibility.state === StampEligibilityState.NO_LOCATION ||
      eligibility.state === StampEligibilityState.TOO_FAR
    ) {
      throw new BadRequestException(eligibility.reason);
    }

    return this.prisma.stamp.upsert({
      where: {
        userId_contentId: { userId: user.id, contentId: dto.contentId },
      },
      update: {}, // 이미 찍었으면 그대로
      create: {
        userId: user.id,
        zone: dto.zone,
        contentId: dto.contentId,
        title: dto.title,
        image: dto.image,
      },
    });
  }

  /**
   * 스탬프 버튼이 어떤 상태여야 하는지 판정(실제로 찍지는 않음) — 장소 상세 화면에서
   * 버튼 디자인/비활성 사유를 미리 보여줄 때 사용.
   */
  async checkEligibility(
    user: User,
    contentId: string,
    curMapX?: string,
    curMapY?: string,
  ): Promise<StampEligibility> {
    const existing = await this.prisma.stamp.findUnique({
      where: { userId_contentId: { userId: user.id, contentId } },
    });
    if (existing) {
      return {
        state: StampEligibilityState.ALREADY_STAMPED,
        reason: '이미 스탬프를 받았어요.',
      };
    }

    if (user.isGuest) {
      return {
        state: StampEligibilityState.REVIEWER,
        reason: null,
      };
    }

    const curPos = toLatLng(curMapX, curMapY);
    if (!curPos) {
      return {
        state: StampEligibilityState.NO_LOCATION,
        reason: '위치 권한을 허용하면 스탬프를 찍을 수 있어요.',
      };
    }

    const targetPos = await this.findSpotPos(contentId);
    if (!targetPos) {
      // 좌표를 확인할 수 없으면 막지 않는다(우리 쪽 데이터 문제로 사용자를 막지 않기 위함)
      return { state: StampEligibilityState.ELIGIBLE, reason: null };
    }

    const distance = Math.round(haversineMeters(curPos, targetPos));
    if (distance > STAMP_MAX_DISTANCE_METERS) {
      return {
        state: StampEligibilityState.TOO_FAR,
        reason: '현재 위치에서 2km 이내여야 스탬프를 찍을 수 있어요.',
        distance,
      };
    }

    return { state: StampEligibilityState.ELIGIBLE, reason: null, distance };
  }

  /** 관광지의 실제 좌표(TourAPI 기준) — 클라이언트가 보낸 좌표를 신뢰하지 않기 위함 */
  private async findSpotPos(contentId: string) {
    try {
      const { items } = await this.tourApi.getList<TourRawItem>(
        'KorService2',
        'detailCommon2',
        { contentId },
      );
      const raw = items[0];
      if (!raw) return null;
      return toLatLng(raw.mapx, raw.mapy);
    } catch {
      return null;
    }
  }

  /**
   * 내 스탬프 목록. zone 을 주면 필터링, order 로 최신/오래된 순 지정.
   * "완료한 스탬프" 카드에 표시할, 그 스탬프가 속한 리뷰(TravelRecord)의 감정(mood)을 함께 반환.
   */
  async findAll(userId: string, zone?: Zone, order: StampSortOrder = 'desc') {
    const stamps = await this.prisma.stamp.findMany({
      where: { userId, ...(zone ? { zone } : {}) },
      orderBy: { visitedAt: order },
      include: {
        travelRecords: {
          select: { mood: true },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });

    return stamps.map(({ travelRecords, ...stamp }) => ({
      ...stamp,
      mood: (travelRecords[0]?.mood as Mood | undefined) ?? null,
    }));
  }

  /** 5개 감성존 완주 진행률 + 리워드 */
  async getProgress(userId: string) {
    const stamps = await this.prisma.stamp.findMany({
      where: { userId },
      select: { zone: true },
    });
    const countByZone = new Map<string, number>();
    for (const s of stamps) {
      countByZone.set(s.zone, (countByZone.get(s.zone) ?? 0) + 1);
    }

    const zones = ALL_ZONES.map((zone) => ({
      zone,
      label: ZONE_META[zone].label,
      stampCount: countByZone.get(zone) ?? 0,
      collected: (countByZone.get(zone) ?? 0) > 0,
    }));
    const collectedCount = zones.filter((z) => z.collected).length;
    const completed = collectedCount === ALL_ZONES.length;

    return {
      totalZones: ALL_ZONES.length,
      collectedCount,
      completed,
      totalStamps: stamps.length,
      zones,
      reward: completed
        ? { badge: '강원 감성 마스터', title: '오감 여행가' }
        : null,
    };
  }

  /** 스탬프 분포 기반 여행 성향(감성존별 비중 %) — 스탬프가 하나도 없으면 전부 0% */
  async getTraits(userId: string) {
    const stamps = await this.prisma.stamp.findMany({
      where: { userId },
      select: { zone: true },
    });
    const total = stamps.length;
    const countByZone = new Map<string, number>();
    for (const s of stamps) {
      countByZone.set(s.zone, (countByZone.get(s.zone) ?? 0) + 1);
    }

    const traits = ALL_ZONES.map((zone) => {
      const count = countByZone.get(zone) ?? 0;
      return {
        zone,
        label: ZONE_META[zone].label,
        count,
        percent: total > 0 ? Math.round((count / total) * 100) : 0,
      };
    }).sort((a, b) => b.percent - a.percent);

    return { totalStamps: total, traits };
  }
}
