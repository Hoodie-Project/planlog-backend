import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { OptInDto } from './dto/opt-in.dto';
import { Zone, ZONE_META } from '../common/gangwon.constants';

@Injectable()
export class MatchService {
  constructor(private readonly prisma: PrismaService) {}

  /** 매칭 옵트인(동일 존·날짜 메이트 찾기에 참여) */
  optIn(userId: string, dto: OptInDto) {
    const travelDate = new Date(dto.travelDate);
    return this.prisma.matchOptIn.upsert({
      where: {
        userId_zone_travelDate: { userId, zone: dto.zone, travelDate },
      },
      update: {},
      create: { userId, zone: dto.zone, travelDate },
    });
  }

  /** 내 옵트인 목록 */
  myOptIns(userId: string) {
    return this.prisma.matchOptIn.findMany({
      where: { userId },
      orderBy: { travelDate: 'asc' },
    });
  }

  /** 옵트인 철회 */
  async withdraw(userId: string, id: string) {
    const optIn = await this.prisma.matchOptIn.findFirst({
      where: { id, userId },
    });
    if (!optIn) throw new NotFoundException('옵트인을 찾을 수 없습니다.');
    await this.prisma.matchOptIn.delete({ where: { id } });
    return { withdrawn: true, id };
  }

  /**
   * 내 옵트인들과 같은 존·날짜로 옵트인한 다른 사용자(메이트) 조회.
   * 상호 옵트인 방식 — 나도 참여한 조합에서만 상대가 보인다(프라이버시).
   */
  async findMates(userId: string) {
    const myOptIns = await this.prisma.matchOptIn.findMany({
      where: { userId },
    });
    if (myOptIns.length === 0) return [];

    const groups = await Promise.all(
      myOptIns.map(async (mine) => {
        const others = await this.prisma.matchOptIn.findMany({
          where: {
            zone: mine.zone,
            travelDate: mine.travelDate,
            userId: { not: userId },
          },
          include: {
            user: {
              select: { id: true, nickname: true, profileImage: true },
            },
          },
        });
        return {
          zone: mine.zone,
          zoneLabel: ZONE_META[mine.zone as Zone]?.label ?? mine.zone,
          travelDate: mine.travelDate.toISOString().slice(0, 10),
          mates: others.map((o) => o.user),
        };
      }),
    );

    // 메이트가 한 명이라도 있는 조합만 반환
    return groups.filter((g) => g.mates.length > 0);
  }
}
