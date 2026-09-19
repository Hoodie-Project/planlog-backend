import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '../../generated/prisma/client.js';
import { CreateSavedCourseDto } from './dto/create-saved-course.dto';
import { CourseDto, CourseItemType } from '../course/dto/course.dto';

export interface StampProgress {
  /** 이 코스 스팟 중 이미 스탬프 찍은 개수 */
  earned: number;
  /** 이 코스의 전체 스팟 개수 */
  total: number;
}

/** 저장한 코스 상태 — DB엔 저장하지 않고 travelDate/완료 여부로 매번 계산 */
export enum SavedCourseStatus {
  PENDING = 'PENDING', // 대기중 — 여행 날짜 미정
  IN_PROGRESS = 'IN_PROGRESS', // 진행중 — 날짜는 정했지만 아직 완료 안 함
  COMPLETED = 'COMPLETED', // 완료 — 유저가 직접 완료 처리했거나, 이 코스로 리뷰를 작성함
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
        c.travelDate,
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
        course.travelDate,
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

  /** 리뷰·스탬프 여부와 무관하게 바로 완료 처리 */
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
        course.travelDate,
        course.completedAt,
        completedByReview,
      ),
    };
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
    travelDate: Date | null,
    completedAt: Date | null,
    completedByReview: boolean,
  ): SavedCourseStatus {
    if (completedAt || completedByReview) return SavedCourseStatus.COMPLETED;
    return travelDate
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
