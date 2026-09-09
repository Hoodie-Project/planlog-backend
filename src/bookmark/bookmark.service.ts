import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateBookmarkDto } from './dto/create-bookmark.dto';
import { BookmarkType } from '../../generated/prisma/enums.js';

@Injectable()
export class BookmarkService {
  constructor(private readonly prisma: PrismaService) {}

  /** 찜 등록(동일 대상이면 갱신) */
  create(userId: string, dto: CreateBookmarkDto) {
    const dDayDate = dto.dDayDate ? new Date(dto.dDayDate) : null;
    return this.prisma.bookmark.upsert({
      where: {
        userId_targetType_targetId: {
          userId,
          targetType: dto.targetType,
          targetId: dto.targetId,
        },
      },
      update: { title: dto.title, image: dto.image, dDayDate },
      create: {
        userId,
        targetType: dto.targetType,
        targetId: dto.targetId,
        title: dto.title,
        image: dto.image,
        dDayDate,
      },
    });
  }

  findAll(userId: string, type?: BookmarkType) {
    return this.prisma.bookmark.findMany({
      where: { userId, ...(type ? { targetType: type } : {}) },
      orderBy: { createdAt: 'desc' },
    });
  }

  /** D-Day 임박 찜 — 오늘부터 withinDays 일 이내(당일 포함) 남은 순으로 정렬 */
  async findUpcoming(userId: string, withinDays: number) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const until = new Date(today);
    until.setDate(until.getDate() + withinDays);

    const bookmarks = await this.prisma.bookmark.findMany({
      where: {
        userId,
        dDayDate: { gte: today, lte: until },
      },
      orderBy: { dDayDate: 'asc' },
    });

    return bookmarks.map((b) => ({
      ...b,
      daysUntil: Math.round(
        (b.dDayDate!.getTime() - today.getTime()) / 86_400_000,
      ),
    }));
  }

  async remove(userId: string, id: string) {
    const bookmark = await this.prisma.bookmark.findFirst({
      where: { id, userId },
    });
    if (!bookmark) throw new NotFoundException('찜을 찾을 수 없습니다.');
    await this.prisma.bookmark.delete({ where: { id } });
    return { deleted: true, id };
  }
}
