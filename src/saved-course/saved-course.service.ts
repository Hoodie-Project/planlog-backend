import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '../../generated/prisma/client.js';
import { CreateSavedCourseDto } from './dto/create-saved-course.dto';

/** 저장한 코스 상태 — DB엔 저장하지 않고 travelDate/리뷰 존재 여부로 매번 계산 */
export enum SavedCourseStatus {
  PENDING = 'PENDING', // 대기중 — 여행 날짜 미정
  IN_PROGRESS = 'IN_PROGRESS', // 진행중 — 날짜는 정했지만 이 코스로 쓴 리뷰가 아직 없음
  COMPLETED = 'COMPLETED', // 완료 — 이 코스로 여행 기록(리뷰)을 작성함
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
    const [courses, completedIds] = await Promise.all([
      this.prisma.savedCourse.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
      }),
      this.getCompletedIds(userId),
    ]);

    const withStatus = courses.map((c) => ({
      ...c,
      status: this.resolveStatus(c.travelDate, completedIds.has(c.id)),
    }));

    return status ? withStatus.filter((c) => c.status === status) : withStatus;
  }

  /** "다가오는 여행" — 날짜를 정했고 아직 완료(리뷰) 안 한 것 중 가장 가까운 순 */
  async findUpcoming(userId: string, limit = 1) {
    const completedIds = await this.getCompletedIds(userId);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const courses = await this.prisma.savedCourse.findMany({
      where: { userId, travelDate: { not: null } },
      orderBy: { travelDate: 'asc' },
    });

    return courses
      .filter((c) => !completedIds.has(c.id))
      .slice(0, limit)
      .map((c) => ({
        ...c,
        status: SavedCourseStatus.IN_PROGRESS as const,
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
    const completedIds = await this.getCompletedIds(userId);
    return {
      ...course,
      status: this.resolveStatus(
        course.travelDate,
        completedIds.has(course.id),
      ),
    };
  }

  async remove(userId: string, id: string) {
    await this.findOne(userId, id); // 소유권 확인
    await this.prisma.savedCourse.delete({ where: { id } });
    return { deleted: true, id };
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
    completed: boolean,
  ): SavedCourseStatus {
    if (completed) return SavedCourseStatus.COMPLETED;
    return travelDate
      ? SavedCourseStatus.IN_PROGRESS
      : SavedCourseStatus.PENDING;
  }
}
