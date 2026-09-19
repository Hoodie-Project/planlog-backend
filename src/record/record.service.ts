import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '../../generated/prisma/client.js';
import { CreateRecordDto } from './dto/create-record.dto';
import { CourseDto, CourseItemType } from '../course/dto/course.dto';

const RECORD_INCLUDE = {
  stamps: {
    select: {
      id: true,
      zone: true,
      contentId: true,
      title: true,
      image: true,
      visitedAt: true,
    },
  },
} satisfies Prisma.TravelRecordInclude;

@Injectable()
export class RecordService {
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: string, dto: CreateRecordDto) {
    const courseStats = dto.savedCourseId
      ? await this.getCourseStats(userId, dto.savedCourseId)
      : null;

    // 본인 소유 스탬프만 연결(다른 유저 스탬프 ID가 섞여 들어와도 무시)
    const stampIds = dto.stampIds?.length
      ? (
          await this.prisma.stamp.findMany({
            where: { userId, id: { in: dto.stampIds } },
            select: { id: true },
          })
        ).map((s) => s.id)
      : [];

    return this.prisma.travelRecord.create({
      data: {
        userId,
        title: dto.title,
        travelDate: new Date(dto.travelDate),
        location: dto.location,
        note: dto.note,
        mood: dto.mood,
        image: dto.image,
        tags: dto.tags as Prisma.InputJsonValue,
        savedCourseId: dto.savedCourseId,
        spotCount: courseStats?.spotCount,
        totalDistance: courseStats?.totalDistance,
        nights: courseStats?.nights,
        stamps: stampIds.length ? { connect: stampIds.map((id) => ({ id })) } : undefined,
      },
      include: RECORD_INCLUDE,
    });
  }

  /** 저장 코스 스냅샷(payload=CourseDto)에서 방문 장소 수/총 이동거리/박수를 뽑아온다. */
  private async getCourseStats(userId: string, savedCourseId: string) {
    const savedCourse = await this.prisma.savedCourse.findFirst({
      where: { id: savedCourseId, userId },
      select: { payload: true, nights: true },
    });
    if (!savedCourse) {
      throw new NotFoundException('저장한 코스를 찾을 수 없습니다.');
    }
    const course = savedCourse.payload as unknown as CourseDto;
    const spotCount = (course.days ?? []).reduce(
      (sum, day) =>
        sum + (day.items ?? []).filter((item) => item.type === CourseItemType.SPOT).length,
      0,
    );
    return {
      spotCount,
      totalDistance: course.totalDistance ?? 0,
      nights: savedCourse.nights,
    };
  }

  findAll(userId: string) {
    return this.prisma.travelRecord.findMany({
      where: { userId },
      orderBy: { travelDate: 'desc' },
      include: RECORD_INCLUDE,
    });
  }

  async findOne(userId: string, id: string) {
    const record = await this.prisma.travelRecord.findFirst({
      where: { id, userId },
      include: RECORD_INCLUDE,
    });
    if (!record) throw new NotFoundException('기록을 찾을 수 없습니다.');
    return record;
  }

  async remove(userId: string, id: string) {
    await this.findOne(userId, id);
    await this.prisma.travelRecord.delete({ where: { id } });
    return { success: true };
  }

  /** mood 를 남긴 최근 기록 상위 N개를 랭킹 형태로 — "동행자 감정 후기" 카드용 */
  async getHighlights(userId: string, limit = 3) {
    const records = await this.prisma.travelRecord.findMany({
      where: { userId, mood: { not: null } },
      orderBy: { travelDate: 'desc' },
      take: limit,
      select: { mood: true, note: true },
    });
    return records.map((r, idx) => ({
      rank: idx + 1,
      mood: r.mood as string,
      quote: r.note,
    }));
  }
}
