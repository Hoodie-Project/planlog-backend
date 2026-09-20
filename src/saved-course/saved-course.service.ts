import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '../../generated/prisma/client.js';
import { CreateSavedCourseDto } from './dto/create-saved-course.dto';
import { ReplaceCourseItemDto } from './dto/replace-course-item.dto';
import {
  CourseDayDto,
  CourseDto,
  CourseItemType,
} from '../course/dto/course.dto';
import { Style, inferZone } from '../common/gangwon.constants';
import {
  LatLng,
  haversineMeters,
  toLatLng,
  travelMinutes,
} from '../common/geo';

const SPOT_STAY_MIN = 90;
const FAMILY_SPOT_STAY_MIN = 120;
const MEAL_STAY_MIN = 60;

export interface StampProgress {
  /** 이 코스 스팟 중 이미 스탬프 찍은 개수 */
  earned: number;
  /** 이 코스의 전체 스팟 개수 */
  total: number;
}

/**
 * 저장한 코스 상태 — DB엔 계산 근거(startedAt/completedAt)만 저장하고 상태 자체는 매번 계산.
 * travelDate 는 상태와 무관("다가오는 여행" D-Day 표시에만 사용) — "코스 시작하기"/"코스 종료하기"
 * 버튼(명시적 액션)이 기준이다.
 */
export enum SavedCourseStatus {
  PENDING = 'PENDING', // 대기중 — 아직 "코스 시작하기"를 안 누름
  IN_PROGRESS = 'IN_PROGRESS', // 진행중 — "코스 시작하기"를 누름
  COMPLETED = 'COMPLETED', // 완료 — "코스 종료하기" 후 리뷰를 작성했거나, 직접 완료 처리함
}

@Injectable()
export class SavedCourseService {
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: string, dto: CreateSavedCourseDto) {
    const course = dto.course;
    const travelDateRaw = dto.travelDate ?? course.congestion?.date;
    return this.prisma.savedCourse.create({
      data: {
        userId,
        title: dto.title ?? course.summary ?? '내 코스',
        zone: course.zone,
        nights: course.nights ?? 0,
        travelDate: travelDateRaw ? new Date(travelDateRaw) : null,
        // 클래스 인스턴스(CourseDto)를 Prisma Json 필드가 요구하는 순수 JSON 값으로 변환
        payload: JSON.parse(JSON.stringify(course)) as Prisma.InputJsonValue,
      },
    });
  }

  /** 최신순. status 를 주면 대기중/진행중/완료로 필터링(목록 상단 필터 칩용) */
  async findAll(userId: string, status?: SavedCourseStatus) {
    const [courses, completedIds, stampedContentIds] = await Promise.all([
      this.prisma.savedCourse.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
      }),
      this.getCompletedIds(userId),
      this.getStampedContentIds(userId),
    ]);

    const withStatus = courses.map((c) => ({
      ...c,
      status: this.resolveStatus(
        c.startedAt,
        c.completedAt,
        completedIds.has(c.id),
      ),
      stampProgress: this.computeStampProgress(c.payload, stampedContentIds),
    }));

    return status ? withStatus.filter((c) => c.status === status) : withStatus;
  }

  /** "다가오는 여행" — 날짜를 정했고 아직 완료(리뷰) 안 한 것 중 가장 가까운 순 */
  async findUpcoming(userId: string, limit = 1) {
    const [completedIds, stampedContentIds] = await Promise.all([
      this.getCompletedIds(userId),
      this.getStampedContentIds(userId),
    ]);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const courses = await this.prisma.savedCourse.findMany({
      where: { userId, travelDate: { not: null } },
      orderBy: { travelDate: 'asc' },
    });

    return courses
      .filter((c) => !c.completedAt && !completedIds.has(c.id))
      .slice(0, limit)
      .map((c) => ({
        ...c,
        status: SavedCourseStatus.IN_PROGRESS as const,
        stampProgress: this.computeStampProgress(c.payload, stampedContentIds),
        daysUntil: Math.round(
          (c.travelDate!.getTime() - today.getTime()) / 86_400_000,
        ),
      }));
  }

  async findOne(userId: string, id: string) {
    const course = await this.prisma.savedCourse.findFirst({
      where: { id, userId },
    });
    if (!course) throw new NotFoundException('저장된 코스를 찾을 수 없습니다.');
    const [completedIds, stampedContentIds] = await Promise.all([
      this.getCompletedIds(userId),
      this.getStampedContentIds(userId),
    ]);
    return {
      ...course,
      status: this.resolveStatus(
        course.startedAt,
        course.completedAt,
        completedIds.has(course.id),
      ),
      stampProgress: this.computeStampProgress(
        course.payload,
        stampedContentIds,
      ),
    };
  }

  async remove(userId: string, id: string) {
    await this.findOne(userId, id); // 소유권 확인
    await this.prisma.savedCourse.delete({ where: { id } });
    return { deleted: true, id };
  }

  /** "코스 시작하기" — 대기중 → 진행중 */
  async start(userId: string, id: string) {
    await this.assertOwned(userId, id);
    const course = await this.prisma.savedCourse.update({
      where: { id },
      data: { startedAt: new Date() },
    });
    const completedByReview = (await this.getCompletedIds(userId)).has(id);
    return {
      ...course,
      status: this.resolveStatus(
        course.startedAt,
        course.completedAt,
        completedByReview,
      ),
    };
  }

  /** 리뷰·스탬프 여부와 무관하게 바로 완료 처리("코스 종료하기" 후 리뷰 저장 없이도 강제 완료할 때) */
  async complete(userId: string, id: string) {
    await this.assertOwned(userId, id);
    const course = await this.prisma.savedCourse.update({
      where: { id },
      data: { completedAt: new Date() },
    });
    return { ...course, status: SavedCourseStatus.COMPLETED };
  }

  /** 완료 취소(리뷰가 걸려있으면 여전히 완료로 보일 수 있음) */
  async uncomplete(userId: string, id: string) {
    await this.assertOwned(userId, id);
    const course = await this.prisma.savedCourse.update({
      where: { id },
      data: { completedAt: null },
    });
    const completedByReview = (await this.getCompletedIds(userId)).has(id);
    return {
      ...course,
      status: this.resolveStatus(
        course.startedAt,
        course.completedAt,
        completedByReview,
      ),
    };
  }

  /**
   * 코스의 특정 항목(장소/점심/숙소)을 다른 후보로 교체(order 지정), 또는 그 날에 없던
   * 숙소를 새로 추가(order 생략 — "숙소 선택하기"). GET /spots/location,
   * /accommodations/location 등에서 고른 후보를 그대로 넘기면 됨.
   * 처리 이후 그 날 동선의 이동거리·이동시간·도착시각을 연쇄 재계산한다.
   * ⚠️ 그 날의 "출발 앵커" 좌표는 저장돼 있지 않아, 1번째 항목을 교체하면
   *    그 항목을 새 출발점으로 재정의한다(이동거리 0으로 리셋, 시작 시각은 유지).
   */
  async replaceItem(userId: string, id: string, dto: ReplaceCourseItemDto) {
    const saved = await this.prisma.savedCourse.findFirst({
      where: { id, userId },
    });
    if (!saved) throw new NotFoundException('저장된 코스를 찾을 수 없습니다.');

    const newPos = toLatLng(dto.mapX, dto.mapY);
    if (!newPos) {
      throw new BadRequestException('mapX/mapY 가 올바르지 않습니다.');
    }

    const course = saved.payload as unknown as CourseDto;
    const day = course.days.find((d) => d.day === dto.day);
    if (!day) throw new NotFoundException('해당 일자를 찾을 수 없습니다.');

    if (dto.order === undefined) {
      this.appendItem(day, course, dto, newPos);
    } else {
      this.replaceExistingItem(day, course, dto, newPos);
    }

    this.recomputeDayTotals(day);
    course.totalDistance = course.days.reduce((s, d) => s + d.distance, 0);
    course.totalTravelMinutes = course.days.reduce(
      (s, d) => s + d.travelMinutes,
      0,
    );

    const updated = await this.prisma.savedCourse.update({
      where: { id },
      data: {
        payload: JSON.parse(JSON.stringify(course)) as Prisma.InputJsonValue,
      },
    });

    const [completedIds, stampedContentIds] = await Promise.all([
      this.getCompletedIds(userId),
      this.getStampedContentIds(userId),
    ]);
    return {
      ...updated,
      status: this.resolveStatus(
        updated.startedAt,
        updated.completedAt,
        completedIds.has(updated.id),
      ),
      stampProgress: this.computeStampProgress(
        updated.payload,
        stampedContentIds,
      ),
    };
  }

  /** order 생략 시 "숙소 선택하기" — 그 날 마지막에 새 숙소 항목을 추가 */
  private appendItem(
    day: CourseDayDto,
    course: CourseDto,
    dto: ReplaceCourseItemDto,
    newPos: LatLng,
  ): void {
    const last = day.items[day.items.length - 1] as
      | (typeof day.items)[number]
      | undefined;
    const prevPos = last ? (toLatLng(last.mapX, last.mapY) ?? newPos) : newPos;
    const prevClock = last
      ? this.parseClock(last.arriveTime) + last.stayMinutes
      : this.parseClock('10:00');
    const dist = last ? haversineMeters(prevPos, newPos) : 0;
    const travel = last ? travelMinutes(dist, course.transport) : 0;
    const newOrder = day.items.length
      ? Math.max(...day.items.map((i) => i.order)) + 1
      : 1;

    day.items.push({
      order: newOrder,
      type: CourseItemType.STAY,
      contentId: dto.contentId,
      title: dto.title,
      zone: dto.zone ?? inferZone(dto.title),
      address: dto.address,
      image: dto.image,
      mapX: dto.mapX,
      mapY: dto.mapY,
      arriveTime: this.formatClock(prevClock + travel),
      stayMinutes: 0,
      travelMinutesFromPrev: travel,
      distanceFromPrev: Math.round(dist),
    });
  }

  /** order 지정 시 — 기존 항목을 다른 후보로 교체, 이후 항목들 연쇄 재계산 */
  private replaceExistingItem(
    day: CourseDayDto,
    course: CourseDto,
    dto: ReplaceCourseItemDto,
    newPos: LatLng,
  ): void {
    const idx = day.items.findIndex((i) => i.order === dto.order);
    if (idx === -1) {
      throw new NotFoundException('해당 순서의 항목을 찾을 수 없습니다.');
    }

    const target = day.items[idx];
    const stayMinutes = this.defaultStayMinutes(target.type, course.style);

    if (idx === 0) {
      // 앵커 좌표가 없어 첫 항목은 새 출발점으로 재정의(이동거리 0, 시작 시각은 유지)
      const dayStartClock =
        this.parseClock(target.arriveTime) - target.travelMinutesFromPrev;
      day.items[idx] = {
        ...target,
        contentId: dto.contentId,
        title: dto.title,
        mapX: dto.mapX,
        mapY: dto.mapY,
        address: dto.address,
        image: dto.image,
        zone: dto.zone ?? inferZone(dto.title),
        distanceFromPrev: 0,
        travelMinutesFromPrev: 0,
        arriveTime: this.formatClock(dayStartClock),
        stayMinutes,
      };
    } else {
      const prev = day.items[idx - 1];
      const prevPos = toLatLng(prev.mapX, prev.mapY) ?? newPos;
      const dist = haversineMeters(prevPos, newPos);
      const travel = travelMinutes(dist, course.transport);
      const prevClock = this.parseClock(prev.arriveTime) + prev.stayMinutes;
      day.items[idx] = {
        ...target,
        contentId: dto.contentId,
        title: dto.title,
        mapX: dto.mapX,
        mapY: dto.mapY,
        address: dto.address,
        image: dto.image,
        zone: dto.zone ?? inferZone(dto.title),
        distanceFromPrev: Math.round(dist),
        travelMinutesFromPrev: travel,
        arriveTime: this.formatClock(prevClock + travel),
        stayMinutes,
      };
    }

    // 교체된 항목 이후 같은 날의 나머지 항목들을 새 위치 기준으로 연쇄 재계산
    let cursor = newPos;
    let clock =
      this.parseClock(day.items[idx].arriveTime) + day.items[idx].stayMinutes;
    for (let i = idx + 1; i < day.items.length; i++) {
      const it = day.items[i];
      const pos = toLatLng(it.mapX, it.mapY) ?? cursor;
      const dist = haversineMeters(cursor, pos);
      const travel = travelMinutes(dist, course.transport);
      it.distanceFromPrev = Math.round(dist);
      it.travelMinutesFromPrev = travel;
      it.arriveTime = this.formatClock(clock + travel);
      clock = clock + travel + it.stayMinutes;
      cursor = pos;
    }
  }

  private defaultStayMinutes(type: CourseItemType, style: Style): number {
    if (type === CourseItemType.MEAL) return MEAL_STAY_MIN;
    if (type === CourseItemType.STAY) return 0;
    return style === Style.FAMILY ? FAMILY_SPOT_STAY_MIN : SPOT_STAY_MIN;
  }

  private recomputeDayTotals(day: CourseDayDto): void {
    day.distance = Math.round(
      day.items.reduce((s, i) => s + i.distanceFromPrev, 0),
    );
    day.travelMinutes = day.items.reduce(
      (s, i) => s + i.travelMinutesFromPrev,
      0,
    );
    const spotCount = day.items.filter(
      (i) => i.type === CourseItemType.SPOT,
    ).length;
    day.summary = `${day.day}일차 · ${spotCount}곳`;
  }

  /** "HH:mm" → 자정 기준 분 */
  private parseClock(hhmm: string): number {
    const [h, m] = hhmm.split(':').map(Number);
    return h * 60 + m;
  }

  /** 자정 기준 분 → "HH:mm" (24시간 랩어라운드) */
  private formatClock(minutes: number): string {
    const wrapped = ((minutes % 1440) + 1440) % 1440;
    const h = Math.floor(wrapped / 60);
    const m = wrapped % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  }

  /** 존재+소유권만 가볍게 확인(전체 status/stampProgress 계산 없이) */
  private async assertOwned(userId: string, id: string): Promise<void> {
    const course = await this.prisma.savedCourse.findFirst({
      where: { id, userId },
      select: { id: true },
    });
    if (!course) throw new NotFoundException('저장된 코스를 찾을 수 없습니다.');
  }

  /** 리뷰(TravelRecord)가 걸려있는 저장 코스 id 집합 — 완료 판정 기준 */
  private async getCompletedIds(userId: string): Promise<Set<string>> {
    const records = await this.prisma.travelRecord.findMany({
      where: { userId, savedCourseId: { not: null } },
      select: { savedCourseId: true },
    });
    return new Set(records.map((r) => r.savedCourseId!));
  }

  private resolveStatus(
    startedAt: Date | null,
    completedAt: Date | null,
    completedByReview: boolean,
  ): SavedCourseStatus {
    if (completedAt || completedByReview) return SavedCourseStatus.COMPLETED;
    return startedAt
      ? SavedCourseStatus.IN_PROGRESS
      : SavedCourseStatus.PENDING;
  }

  /** 유저가 실제로 찍은 스탬프의 contentId 집합 (리뷰 작성 여부와 무관) */
  private async getStampedContentIds(userId: string): Promise<Set<string>> {
    const stamps = await this.prisma.stamp.findMany({
      where: { userId },
      select: { contentId: true },
    });
    return new Set(stamps.map((s) => s.contentId));
  }

  /**
   * 저장 코스 payload(CourseDto 스냅샷)의 스팟 목록과 유저의 스탬프를 contentId 기준으로 대조.
   * Stamp 테이블엔 savedCourseId 가 없어(리뷰 작성 시에만 연결) 매번 이렇게 계산한다.
   */
  private computeStampProgress(
    payload: Prisma.JsonValue,
    stampedContentIds: Set<string>,
  ): StampProgress {
    const course = payload as unknown as CourseDto;
    const spotContentIds = (course.days ?? []).flatMap((day) =>
      (day.items ?? [])
        .filter((item) => item.type === CourseItemType.SPOT)
        .map((item) => item.contentId),
    );
    const total = spotContentIds.length;
    const earned = spotContentIds.filter((id) =>
      stampedContentIds.has(id),
    ).length;
    return { earned, total };
  }
}
