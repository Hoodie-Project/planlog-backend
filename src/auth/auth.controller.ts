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
import { GuestLoginDto } from './dto/guest-login.dto';
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
    summary: '게스트 로그인 (심사·테스트용, 고정 아이디/비밀번호 — 계정 2개)',
    description: [
      '⚠️ 아이디/비밀번호가 고정값입니다(회원가입 없음). 계정마다 스탬프/저장코스/기록이 서로 독립적입니다(동시에 여러 명이 써도 데이터 안 섞임).',
      '',
      '**고정 계정**',
      '- `{ "guestId": "guest", "password": "2026guest!" }`',
      '- `{ "guestId": "openapi", "password": "2026openapi!" }`',
      '',
      '위 조합이 아니면 401. 앱스토어/플레이스토어 심사 시 테스트 계정 입력란에는 이 중 하나를 그대로 안내하면 됩니다.',
      '**응답(AuthResponseDto)**: `{ accessToken: 서비스 JWT, user: { ..., isGuest: true } }`',
    ].join('\n'),
  })
  @ApiOkResponse({ type: AuthResponseDto })
  guest(@Body() dto: GuestLoginDto) {
    return this.authService.guestLogin(dto);
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
