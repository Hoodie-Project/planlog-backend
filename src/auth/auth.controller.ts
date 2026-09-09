import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { KakaoLoginDto } from './dto/kakao-login.dto';
import { AuthResponseDto, AuthUserDto } from './dto/auth-response.dto';
import { MeStatsDto } from './dto/me-stats.dto';
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
    summary: '게스트 로그인 (심사·테스트용)',
    description: [
      '자격증명 없이 즉시 게스트 계정을 만들고 JWT 를 발급합니다. (요청 본문 없음)',
      '',
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
}
