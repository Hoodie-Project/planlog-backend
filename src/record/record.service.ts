import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '../../generated/prisma/client.js';
import { CreateRecordDto } from './dto/create-record.dto';

@Injectable()
export class RecordService {
  constructor(private readonly prisma: PrismaService) {}

  create(userId: string, dto: CreateRecordDto) {
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
      },
    });
  }

  findAll(userId: string) {
    return this.prisma.travelRecord.findMany({
      where: { userId },
      orderBy: { travelDate: 'desc' },
    });
  }

  async findOne(userId: string, id: string) {
    const record = await this.prisma.travelRecord.findFirst({
      where: { id, userId },
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
