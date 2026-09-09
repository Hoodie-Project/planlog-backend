import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { User } from '../../generated/prisma/client.js';
import { AuthProvider } from '../../generated/prisma/enums.js';
import { AuthResponseDto, AuthUserDto } from './dto/auth-response.dto';
import { MeStatsDto } from './dto/me-stats.dto';
import { RecentActivityDto, RecentActivityType } from './dto/recent-activity.dto';
import { Zone } from '../common/gangwon.constants';

const TOTAL_ZONE_COUNT = Object.values(Zone).length;

interface KakaoProfile {
  id: number;
  kakao_account?: {
    email?: string;
    profile?: {
      nickname?: string;
      profile_image_url?: string;
    };
  };
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  /** 카카오 액세스 토큰으로 프로필 조회 → 가입/로그인 */
  async kakaoLogin(accessToken: string): Promise<AuthResponseDto> {
    const profile = await this.fetchKakaoProfile(accessToken);
    const providerId = String(profile.id);
    const nickname =
      profile.kakao_account?.profile?.nickname ??
      `카카오사용자_${providerId.slice(-4)}`;
    const email = profile.kakao_account?.email ?? null;
    const profileImage =
      profile.kakao_account?.profile?.profile_image_url ?? null;

    const user = await this.prisma.user.upsert({
      where: {
        provider_providerId: { provider: AuthProvider.KAKAO, providerId },
      },
      update: { nickname, email, profileImage },
      create: {
        provider: AuthProvider.KAKAO,
        providerId,
        nickname,
        email,
        profileImage,
        isGuest: false,
      },
    });

    return this.issue(user);
  }

  /** 게스트 계정 발급 (심사·테스트용, 고정 계정 재사용) */
  async guestLogin(): Promise<AuthResponseDto> {
    const user = await this.prisma.user.upsert({
      where: {
        provider_providerId: {
          provider: AuthProvider.GUEST,
          providerId: 'guest',
        },
      },
      update: {},
      create: {
        provider: AuthProvider.GUEST,
        providerId: 'guest',
        nickname: 'Guest',
        isGuest: true,
      },
    });
    return this.issue(user);
  }

  /** 마이페이지 요약 통계 */
  async getStats(userId: string): Promise<MeStatsDto> {
    const [savedCoursesCount, bookmarksCount, stamps, recordsCount] =
      await Promise.all([
        this.prisma.savedCourse.count({ where: { userId } }),
        this.prisma.bookmark.count({ where: { userId } }),
        this.prisma.stamp.findMany({
          where: { userId },
          select: { zone: true },
        }),
        this.prisma.travelRecord.count({ where: { userId } }),
      ]);
    const collectedZoneCount = new Set(stamps.map((s) => s.zone)).size;

    return {
      savedCoursesCount,
      bookmarksCount,
      stampsCount: stamps.length,
      collectedZoneCount,
      totalZoneCount: TOTAL_ZONE_COUNT,
      recordsCount,
    };
  }

  /** 저장한 코스/스탬프/기록 카드 최근 활동을 시간순으로 병합 ("나의 기록" 최근 활동 피드용) */
  async getRecentActivities(
    userId: string,
    limit = 10,
  ): Promise<RecentActivityDto[]> {
    const [savedCourses, stamps, records] = await Promise.all([
      this.prisma.savedCourse.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: limit,
        select: { title: true, createdAt: true },
      }),
      this.prisma.stamp.findMany({
        where: { userId },
        orderBy: { visitedAt: 'desc' },
        take: limit,
        select: { title: true, visitedAt: true },
      }),
      this.prisma.travelRecord.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: limit,
        select: { title: true, createdAt: true },
      }),
    ]);

    const activities: RecentActivityDto[] = [
      ...savedCourses.map((c) => ({
        type: RecentActivityType.SAVED_COURSE,
        title: `${c.title} 저장`,
        occurredAt: c.createdAt,
      })),
      ...stamps.map((s) => ({
        type: RecentActivityType.STAMP,
        title: `${s.title} 스탬프 획득`,
        occurredAt: s.visitedAt,
      })),
      ...records.map((r) => ({
        type: RecentActivityType.RECORD,
        title: `${r.title} 기록 카드 작성`,
        occurredAt: r.createdAt,
      })),
    ];

    return activities
      .sort((a, b) => b.occurredAt.getTime() - a.occurredAt.getTime())
      .slice(0, limit);
  }

  private async fetchKakaoProfile(accessToken: string): Promise<KakaoProfile> {
    let res: Response;
    try {
      res = await fetch('https://kapi.kakao.com/v2/user/me', {
        headers: { Authorization: `Bearer ${accessToken}` },
        signal: AbortSignal.timeout(8_000),
      });
    } catch (e) {
      this.logger.error('카카오 프로필 조회 네트워크 오류', e as Error);
      throw new UnauthorizedException('카카오 인증 서버 연결에 실패했습니다.');
    }
    if (!res.ok) {
      throw new UnauthorizedException(
        '유효하지 않은 카카오 액세스 토큰입니다.',
      );
    }
    return (await res.json()) as KakaoProfile;
  }

  private issue(user: User): AuthResponseDto {
    const accessToken = this.jwt.sign({
      sub: user.id,
      provider: user.provider,
    });
    return { accessToken, user: this.toDto(user) };
  }

  private toDto(user: User): AuthUserDto {
    return {
      id: user.id,
      provider: user.provider,
      nickname: user.nickname,
      email: user.email,
      profileImage: user.profileImage,
      isGuest: user.isGuest,
    };
  }
}
