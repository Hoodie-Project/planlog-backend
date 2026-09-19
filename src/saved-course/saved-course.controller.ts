import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiProperty,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { SavedCourseService, SavedCourseStatus } from './saved-course.service';
import { CreateSavedCourseDto } from './dto/create-saved-course.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import type { User } from '../../generated/prisma/client.js';

export class SavedCourseEntityDto {
  @ApiProperty({ example: 'cmq7x...' }) id: string;
  @ApiProperty() userId: string;
  @ApiProperty({ example: '속초 뚜벅이 당일치기' }) title: string;
  @ApiProperty({ example: 'SEA' }) zone: string;
  @ApiProperty({ example: 0 }) nights: number;
  @ApiProperty({ nullable: true, description: '여행 날짜(선택)' })
  travelDate: Date | null;
  @ApiProperty({
    enum: SavedCourseStatus,
    description: '대기중(날짜 미정)/진행중(날짜만 정함)/완료(리뷰 작성함)',
  })
  status: SavedCourseStatus;
  @ApiProperty({
    description: '저장된 코스(CourseDto) 스냅샷',
    type: 'object',
    additionalProperties: true,
  })
  payload: Record<string, unknown>;
  @ApiProperty() createdAt: Date;
}

export class UpcomingSavedCourseDto extends SavedCourseEntityDto {
  @ApiProperty({ description: '여행 날짜까지 남은 일수(D-Day)', example: 6 })
  daysUntil: number;
}

@ApiTags('내 코스 (Saved Course)')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('saved-courses')
export class SavedCourseController {
  constructor(private readonly savedCourseService: SavedCourseService) {}

  @Post()
  @ApiOperation({
    summary: '코스 저장',
    description:
      'POST /courses/generate 로 받은 코스 객체를 그대로 보내 저장합니다. (JWT 필요) 관광 원본은 contentId 참조이므로 코스 스냅샷만 DB에 저장됩니다. travelDate 를 주면(또는 코스에 congestion.date 가 있으면) "다가오는 여행" D-Day와 상태 계산에 사용됩니다.',
  })
  @ApiOkResponse({ type: SavedCourseEntityDto })
  create(@CurrentUser() user: User, @Body() dto: CreateSavedCourseDto) {
    return this.savedCourseService.create(user.id, dto);
  }

  @Get()
  @ApiOperation({
    summary: '내 저장 코스 목록',
    description:
      '최신순. status 로 대기중/진행중/완료 필터링 가능("저장한 코스" 페이지 필터 칩용). (JWT 필요)',
  })
  @ApiQuery({
    name: 'status',
    required: false,
    enum: SavedCourseStatus,
    description: '대기중(PENDING)/진행중(IN_PROGRESS)/완료(COMPLETED) 필터',
  })
  @ApiOkResponse({ type: [SavedCourseEntityDto] })
  findAll(
    @CurrentUser() user: User,
    @Query('status') status?: SavedCourseStatus,
  ) {
    return this.savedCourseService.findAll(user.id, status);
  }

  @Get('upcoming')
  @ApiOperation({
    summary: '다가오는 여행',
    description:
      '여행 날짜를 정했고 아직 리뷰를 안 쓴(=완료 안 된) 저장 코스 중 가장 가까운 순. "저장한 코스" 페이지 상단 카드용. (JWT 필요)',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    description: '최대 개수(기본 1)',
  })
  @ApiOkResponse({ type: [UpcomingSavedCourseDto] })
  findUpcoming(@CurrentUser() user: User, @Query('limit') limitRaw?: string) {
    const parsed = Number(limitRaw);
    const limit = Number.isFinite(parsed) ? Math.max(1, Math.trunc(parsed)) : 1;
    return this.savedCourseService.findUpcoming(user.id, limit);
  }

  @Get(':id')
  @ApiOperation({
    summary: '저장 코스 상세',
    description: 'payload 에 코스 전체가 들어있음. (JWT 필요)',
  })
  @ApiOkResponse({ type: SavedCourseEntityDto })
  findOne(@CurrentUser() user: User, @Param('id') id: string) {
    return this.savedCourseService.findOne(user.id, id);
  }

  @Delete(':id')
  @ApiOperation({
    summary: '저장 코스 삭제',
    description: '본인 코스만 삭제. (JWT 필요)',
  })
  remove(@CurrentUser() user: User, @Param('id') id: string) {
    return this.savedCourseService.remove(user.id, id);
  }
}
