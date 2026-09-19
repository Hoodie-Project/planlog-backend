import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateStampDto } from './dto/create-stamp.dto';
import { Zone, ZONE_META } from '../common/gangwon.constants';
import { Mood } from '../common/mood.constants';

const ALL_ZONES = Object.values(Zone);

export type StampSortOrder = 'asc' | 'desc';

@Injectable()
export class StampService {
  constructor(private readonly prisma: PrismaService) {}

  /** 관광지 방문 인증 → 스탬프 획득(같은 관광지는 1회만, 멱등) */
  create(userId: string, dto: CreateStampDto) {
    return this.prisma.stamp.upsert({
      where: { userId_contentId: { userId, contentId: dto.contentId } },
      update: {}, // 이미 찍었으면 그대로
      create: {
        userId,
        zone: dto.zone,
        contentId: dto.contentId,
        title: dto.title,
        image: dto.image,
      },
    });
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
