import {
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { User } from '../../generated/prisma/client.js';
import { AuthProvider } from '../../generated/prisma/enums.js';
import { AuthResponseDto, AuthUserDto } from './dto/auth-response.dto';

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
      profile.kakao_account?.profile?.nickname ?? `카카오사용자_${providerId.slice(-4)}`;
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

  /** 게스트 계정 발급 (심사·테스트용, 자격증명 없음) */
  async guestLogin(): Promise<AuthResponseDto> {
    const suffix = Math.random().toString(36).slice(2, 8);
    const user = await this.prisma.user.create({
      data: {
        provider: AuthProvider.GUEST,
        nickname: `게스트_${suffix}`,
        isGuest: true,
      },
    });
    return this.issue(user);
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
      throw new UnauthorizedException('유효하지 않은 카카오 액세스 토큰입니다.');
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
