import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiProperty,
  ApiTags,
} from '@nestjs/swagger';
import { StampService } from './stamp.service';
import { CreateStampDto } from './dto/create-stamp.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import type { User } from '../../generated/prisma/client.js';

export class StampEntityDto {
  @ApiProperty() id: string;
  @ApiProperty() userId: string;
  @ApiProperty({ example: 'SEA' }) zone: string;
  @ApiProperty() contentId: string;
  @ApiProperty() title: string;
  @ApiProperty({ nullable: true }) image: string | null;
  @ApiProperty() visitedAt: Date;
}

class ZoneProgressDto {
  @ApiProperty({ example: 'SEA' }) zone: string;
  @ApiProperty({ example: '동해 바다존' }) label: string;
  @ApiProperty({ example: 2 }) stampCount: number;
  @ApiProperty({ example: true }) collected: boolean;
}

export class StampProgressDto {
  @ApiProperty({ example: 5 }) totalZones: number;
  @ApiProperty({ example: 3 }) collectedCount: number;
  @ApiProperty({ example: false }) completed: boolean;
  @ApiProperty({ example: 7 }) totalStamps: number;
  @ApiProperty({ type: [ZoneProgressDto] }) zones: ZoneProgressDto[];
  @ApiProperty({
    nullable: true,
    description: '5존 완주 시 리워드',
    example: { badge: '강원 감성 마스터', title: '오감 여행가' },
  })
  reward: { badge: string; title: string } | null;
}

class ZoneTraitDto {
  @ApiProperty({ example: 'SEA' }) zone: string;
  @ApiProperty({ example: '동해 바다존' }) label: string;
  @ApiProperty({ description: '해당 존 스탬프 수', example: 3 }) count: number;
  @ApiProperty({ description: '전체 스탬프 중 비중(%)', example: 42 })
  percent: number;
}

export class StampTraitsDto {
  @ApiProperty({ example: 7 }) totalStamps: number;
  @ApiProperty({
    type: [ZoneTraitDto],
    description: '비중(percent) 내림차순 정렬',
  })
  traits: ZoneTraitDto[];
}

@ApiTags('감성 스탬프 (Stamp)')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('stamps')
export class StampController {
  constructor(private readonly stampService: StampService) {}

  @Post()
  @ApiOperation({
    summary: '관광지 방문 인증(스탬프 획득)',
    description:
      '코스 내 관광지를 실제 방문했을 때 해당 감성존 도장을 찍습니다. 같은 관광지는 한 번만 인정(멱등). (JWT 필요)',
  })
  @ApiOkResponse({ type: StampEntityDto })
  create(@CurrentUser() user: User, @Body() dto: CreateStampDto) {
    return this.stampService.create(user.id, dto);
  }

  @Get()
  @ApiOperation({
    summary: '내 스탬프 목록',
    description: '최신 방문순. (JWT 필요)',
  })
  @ApiOkResponse({ type: [StampEntityDto] })
  findAll(@CurrentUser() user: User) {
    return this.stampService.findAll(user.id);
  }

  @Get('progress')
  @ApiOperation({
    summary: '감성존 완주 진행률',
    description:
      '5개 감성존(SEA/SNOW/VALLEY/RETRO/PHOTO) 수집 현황. 5존 모두 채우면 리워드(뱃지·칭호) 지급. (JWT 필요)',
  })
  @ApiOkResponse({ type: StampProgressDto })
  getProgress(@CurrentUser() user: User) {
    return this.stampService.getProgress(user.id);
  }

  @Get('traits')
  @ApiOperation({
    summary: '여행 성향(감성존 비중)',
    description:
      '보유 스탬프의 감성존 분포를 비중(%)으로 반환. 스탬프가 없으면 전부 0%. "나의 기록" 페이지의 여행 성향 그래프용. (JWT 필요)',
  })
  @ApiOkResponse({ type: StampTraitsDto })
  getTraits(@CurrentUser() user: User) {
    return this.stampService.getTraits(user.id);
  }
}
