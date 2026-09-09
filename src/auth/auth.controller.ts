import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { KakaoLoginDto } from './dto/kakao-login.dto';
import { AuthResponseDto, AuthUserDto } from './dto/auth-response.dto';
import { MeStatsDto } from './dto/me-stats.dto';
import { RecentActivityDto } from './dto/recent-activity.dto';
import { JwtAuthGuard } from './jwt-auth.guard';
import { CurrentUser } from './current-user.decorator';
import type { User } from '../../generated/prisma/client.js';

@ApiTags('인증 (Auth)')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('kakao')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: '카카오 로그인',
    description: [
      '클라이언트(카카오 SDK)에서 받은 access_token 을 보내면, 카카오 프로필을 조회해 가입/로그인 후 서비스 JWT 를 발급합니다.',
      '',
      '**요청 본문**: `{ "accessToken": "카카오 액세스 토큰" }`',
      '**응답(AuthResponseDto)**: `{ accessToken: 서비스 JWT, user: { id, provider, nickname, email, profileImage, isGuest } }`',
    ].join('\n'),
  })
  @ApiOkResponse({ type: AuthResponseDto })
  kakao(@Body() dto: KakaoLoginDto) {
    return this.authService.kakaoLogin(dto.accessToken);
  }

  @Post('guest')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: '게스트 로그인 (심사·테스트용, 아이디/비밀번호 없음)',
    description: [
      '⚠️ 별도의 아이디·비밀번호가 존재하지 않습니다. 이 API를 호출(요청 본문 없이 POST)하는 것 자체가 로그인이며, 즉시 고정 게스트 계정("Guest")으로 JWT가 발급됩니다.',
      '앱스토어/플레이스토어 심사 시 테스트 계정 입력란에는 **"게스트로 시작하기" 버튼 클릭만으로 로그인됨(계정 정보 입력 불필요)** 이라고 안내하면 됩니다.',
      '',
      '**요청 본문**: 없음',
      '**응답(AuthResponseDto)**: `{ accessToken: 서비스 JWT, user: { ..., isGuest: true } }`',
    ].join('\n'),
  })
  @ApiOkResponse({ type: AuthResponseDto })
  guest() {
    return this.authService.guestLogin();
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: '내 정보 조회',
    description:
      '유효한 JWT 필요. 헤더 `Authorization: Bearer <accessToken>`. **응답**: AuthUserDto',
  })
  @ApiOkResponse({ type: AuthUserDto })
  me(@CurrentUser() user: User): AuthUserDto {
    return {
      id: user.id,
      provider: user.provider,
      nickname: user.nickname,
      email: user.email,
      profileImage: user.profileImage,
      isGuest: user.isGuest,
    };
  }

  @Get('me/stats')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: '마이페이지 요약 통계',
    description:
      '저장한 코스/찜/스탬프 개수와 감성존 완주 현황. 유효한 JWT 필요.',
  })
  @ApiOkResponse({ type: MeStatsDto })
  stats(@CurrentUser() user: User) {
    return this.authService.getStats(user.id);
  }

  @Get('me/recent-activities')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: '최근 활동 피드',
    description:
      '저장한 코스/스탬프 획득을 시간순으로 병합해 최신순 반환. "나의 기록" 페이지 최근 활동 카드용. 유효한 JWT 필요.',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    description: '최대 개수(기본 10, 1~30)',
  })
  @ApiOkResponse({ type: [RecentActivityDto] })
  recentActivities(
    @CurrentUser() user: User,
    @Query('limit') limitRaw?: string,
  ) {
    const parsed = Number(limitRaw);
    const limit = Number.isFinite(parsed)
      ? Math.min(30, Math.max(1, Math.trunc(parsed)))
      : 10;
    return this.authService.getRecentActivities(user.id, limit);
  }
}
