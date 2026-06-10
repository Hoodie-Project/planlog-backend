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

  async remove(userId: string, id: string) {
    const bookmark = await this.prisma.bookmark.findFirst({
      where: { id, userId },
    });
    if (!bookmark) throw new NotFoundException('찜을 찾을 수 없습니다.');
    await this.prisma.bookmark.delete({ where: { id } });
    return { deleted: true, id };
  }
}
