import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiProperty,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { RecordService } from './record.service';
import { CreateRecordDto } from './dto/create-record.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { Zone } from '../common/gangwon.constants';
import { Mood } from '../common/mood.constants';
import type { User } from '../../generated/prisma/client.js';

export class RecordStampDto {
  @ApiProperty() id: string;
  @ApiProperty() zone: string;
  @ApiProperty() contentId: string;
  @ApiProperty() title: string;
  @ApiProperty({ nullable: true }) image: string | null;
  @ApiProperty() visitedAt: Date;
}

export class RecordEntityDto {
  @ApiProperty() id: string;
  @ApiProperty() userId: string;
  @ApiProperty() title: string;
  @ApiProperty() travelDate: Date;
  @ApiProperty() location: string;
  @ApiProperty({ enum: Zone }) zone: Zone;
  @ApiProperty() note: string;
  @ApiProperty({ enum: Mood, nullable: true }) mood: Mood | null;
  @ApiProperty({ nullable: true }) image: string | null;
  @ApiProperty({ type: [String] }) tags: string[];
  @ApiProperty() createdAt: Date;

  @ApiProperty({ nullable: true, description: '근거가 된 저장 코스 ID' })
  savedCourseId: string | null;

  @ApiProperty({
    nullable: true,
    description: '방문 장소 수 (저장 코스 스냅샷)',
  })
  spotCount: number | null;

  @ApiProperty({
    nullable: true,
    description: '총 이동 거리(m) (저장 코스 스냅샷)',
  })
  totalDistance: number | null;

  @ApiProperty({ nullable: true, description: '박수 (저장 코스 스냅샷)' })
  nights: number | null;

  @ApiProperty({
    type: [RecordStampDto],
    description: '이 기록에서 획득한 스탬프',
  })
  stamps: RecordStampDto[];
}

class RecordZoneTraitDto {
  @ApiProperty({ enum: Zone, example: Zone.SEA }) zone: Zone;
  @ApiProperty({ example: '동해 바다존' }) label: string;
  @ApiProperty({ description: '해당 존 리뷰 수', example: 3 }) count: number;
  @ApiProperty({ description: '전체 리뷰 중 비중(%)', example: 42 })
  percent: number;
}

class RecordTravelTypeDto {
  @ApiProperty({ enum: Zone, example: Zone.SEA }) zone: Zone;
  @ApiProperty({ description: '기준이 된 존의 비중(%)', example: 72 })
  percent: number;
  @ApiProperty({ example: '조용한 바다 산책형' }) title: string;
  @ApiProperty({ example: '여유롭게 바다를 거닐며 충전하는 여행자' })
  description: string;
}

export class RecordTraitsDto {
  @ApiProperty({ example: 7 }) totalRecords: number;
  @ApiProperty({
    type: [RecordZoneTraitDto],
    description: '감성존 고정 순서(SEA/SNOW/VALLEY/RETRO/PHOTO)',
  })
  traits: RecordZoneTraitDto[];
  @ApiProperty({
    type: RecordTravelTypeDto,
    nullable: true,
    description: '가장 비중이 높은 존 기준 대표 여행 유형. 리뷰가 없으면 null',
  })
  travelType: RecordTravelTypeDto | null;
}

export class RecordHighlightDto {
  @ApiProperty({ description: '순위(1부터)', example: 1 })
  rank: number;

  @ApiProperty({ enum: Mood, description: '오늘의 감정', example: Mood.CALM })
  mood: Mood;

  @ApiProperty({
    description: '한 줄 소감',
    example: '혼자였지만 충분했던 하루',
  })
  quote: string;
}

@ApiTags('여행 기록 카드 (Record)')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('records')
export class RecordController {
  constructor(private readonly recordService: RecordService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: '기록 카드 작성',
    description:
      '다녀온 여행에 대한 짧은 기록(제목/날짜/지역/한줄소감/태그)을 남깁니다. (JWT 필요)',
  })
  @ApiCreatedResponse({ type: RecordEntityDto })
  create(@CurrentUser() user: User, @Body() dto: CreateRecordDto) {
    return this.recordService.create(user.id, dto);
  }

  @Get()
  @ApiOperation({
    summary: '내 기록 카드 목록',
    description: '여행 날짜 최신순. (JWT 필요)',
  })
  @ApiOkResponse({ type: [RecordEntityDto] })
  findAll(@CurrentUser() user: User) {
    return this.recordService.findAll(user.id);
  }

  @Get('traits')
  @ApiOperation({
    summary: '여행 리뷰 기반 여행 성향',
    description:
      '완료한 코스에 남긴 기록(리뷰)의 감성존 분포와, 가장 비중이 높은 존 기준 대표 여행 유형(타이틀/설명)을 반환. "나의 기록" 페이지 여행 성향 그래프·뱃지용. (JWT 필요)',
  })
  @ApiOkResponse({ type: RecordTraitsDto })
  getTraits(@CurrentUser() user: User) {
    return this.recordService.getTraits(user.id);
  }

  @Get('highlights')
  @ApiOperation({
    summary: '동행자 감정 후기 (기록 하이라이트)',
    description:
      'mood(오늘의 감정)를 남긴 기록 중 최근 순 상위 N개를 랭킹 형태로 반환. 색상 등 표현은 프론트에서 mood 값 기준으로 매핑. (JWT 필요)',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    description: '최대 개수(기본 3, 1~10)',
  })
  @ApiOkResponse({ type: [RecordHighlightDto] })
  getHighlights(@CurrentUser() user: User, @Query('limit') limitRaw?: string) {
    const parsed = Number(limitRaw);
    const limit = Number.isFinite(parsed)
      ? Math.min(10, Math.max(1, Math.trunc(parsed)))
      : 3;
    return this.recordService.getHighlights(user.id, limit);
  }

  @Get(':id')
  @ApiOperation({ summary: '기록 카드 상세', description: '(JWT 필요)' })
  @ApiOkResponse({ type: RecordEntityDto })
  findOne(@CurrentUser() user: User, @Param('id') id: string) {
    return this.recordService.findOne(user.id, id);
  }

  @Delete(':id')
  @ApiOperation({
    summary: '기록 카드 삭제',
    description: '본인 기록만 삭제. (JWT 필요)',
  })
  remove(@CurrentUser() user: User, @Param('id') id: string) {
    return this.recordService.remove(user.id, id);
  }
}
