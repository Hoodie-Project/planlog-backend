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
import type { User } from '../../generated/prisma/client.js';

export class RecordEntityDto {
  @ApiProperty() id: string;
  @ApiProperty() userId: string;
  @ApiProperty() title: string;
  @ApiProperty() travelDate: Date;
  @ApiProperty() location: string;
  @ApiProperty() note: string;
  @ApiProperty({ nullable: true }) mood: string | null;
  @ApiProperty({ nullable: true }) image: string | null;
  @ApiProperty({ type: [String] }) tags: string[];
  @ApiProperty() createdAt: Date;
}

export class RecordHighlightDto {
  @ApiProperty({ description: '순위(1부터)', example: 1 })
  rank: number;

  @ApiProperty({ description: '오늘의 감정', example: '평온함' })
  mood: string;

  @ApiProperty({ description: '한 줄 소감', example: '혼자였지만 충분했던 하루' })
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
  @ApiOperation({ summary: '기록 카드 삭제', description: '본인 기록만 삭제. (JWT 필요)' })
  remove(@CurrentUser() user: User, @Param('id') id: string) {
    return this.recordService.remove(user.id, id);
  }
}
