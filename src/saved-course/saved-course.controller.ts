import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
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
import { ReplaceCourseItemDto } from './dto/replace-course-item.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import type { User } from '../../generated/prisma/client.js';

export class StampProgressDto {
  @ApiProperty({
    description: '이 코스 스팟 중 이미 스탬프 찍은 개수',
    example: 3,
  })
  earned: number;
  @ApiProperty({ description: '이 코스의 전체 스팟 개수', example: 5 })
  total: number;
}

export class SavedCourseEntityDto {
  @ApiProperty({ example: 'cmq7x...' }) id: string;
  @ApiProperty() userId: string;
  @ApiProperty({ example: '속초 뚜벅이 당일치기' }) title: string;
  @ApiProperty({ example: 'SEA' }) zone: string;
  @ApiProperty({ example: 0 }) nights: number;
  @ApiProperty({ nullable: true, description: '여행 날짜(선택, D-Day 표시용)' })
  travelDate: Date | null;
  @ApiProperty({
    nullable: true,
    description: '"코스 시작하기"를 누른 시각(선택)',
  })
  startedAt: Date | null;
  @ApiProperty({
    nullable: true,
    description: '유저가 직접 완료 처리한 시각(선택, 리뷰 없이도 완료 가능)',
  })
  completedAt: Date | null;
  @ApiProperty({
    enum: SavedCourseStatus,
    description:
      '대기중(시작 전)/진행중("코스 시작하기" 누름)/완료(직접 완료 처리했거나 리뷰 작성함)',
  })
  status: SavedCourseStatus;
  @ApiProperty({
    type: StampProgressDto,
    description:
      '이 코스 스팟 대비 스탬프 진행률(리뷰 작성 전에도 contentId 대조로 계산)',
  })
  stampProgress: StampProgressDto;
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
      'POST /courses/generate 로 받은 코스 객체를 그대로 보내 저장합니다. (JWT 필요) 관광 원본은 contentId 참조이므로 코스 스냅샷만 DB에 저장됩니다. travelDate 를 주면(또는 코스에 congestion.date 가 있으면) "다가오는 여행" D-Day 표시에 사용됩니다(상태는 PATCH :id/start, :id/complete 로 별도 전환).',
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
    description:
      'payload 에 코스 전체가 들어있음. stampProgress 로 이 코스 스탬프 진행률(예: 3/5) 확인 가능. (JWT 필요)',
  })
  @ApiOkResponse({ type: SavedCourseEntityDto })
  findOne(@CurrentUser() user: User, @Param('id') id: string) {
    return this.savedCourseService.findOne(user.id, id);
  }

  @Patch(':id/items')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: '저장 코스 항목 교체/추가 (장소/점심 변경, 숙소 변경·선택하기)',
    description: [
      'GET /spots/location, /accommodations/location 등에서 고른 후보로 코스의 특정 항목을 교체하거나(order 지정),',
      '그 날에 없던 숙소를 새로 추가합니다(order 생략 — "숙소 선택하기").',
      '처리 후 그 날 동선의 이동거리·이동시간·도착시각이 자동 재계산됩니다(같은 날 이후 항목들도 연쇄 갱신, 코스 전체 합계도 갱신).',
      '',
      '**입력**',
      '- `day`(필수): 대상 일자(1부터)',
      '- `order`(선택): 교체할 항목의 기존 순서. **생략하면 추가 모드** — 이 날 마지막에 새 숙소 항목 추가',
      '- `contentId`/`title`/`mapX`/`mapY`(필수) — 후보 조회 API 응답 값 그대로',
      '- `address`/`image`/`zone`(선택)',
      '',
      '⚠️ 그 날 1번째 항목을 교체하면(출발 앵커 좌표가 저장돼 있지 않아) 그 항목이 새 출발점으로 재정의됩니다(이동거리 0, 시작 시각은 유지).',
    ].join('\n'),
  })
  @ApiOkResponse({ type: SavedCourseEntityDto })
  replaceItem(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Body() dto: ReplaceCourseItemDto,
  ) {
    return this.savedCourseService.replaceItem(user.id, id, dto);
  }

  @Patch(':id/start')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: '코스 시작하기',
    description:
      '"코스 시작하기" 버튼 클릭 시 호출. 대기중 → 진행중으로 전환하고, 이 코스에 [코스 종료하기] 버튼을 노출할 수 있게 됨. (JWT 필요)',
  })
  @ApiOkResponse({ type: SavedCourseEntityDto })
  start(@CurrentUser() user: User, @Param('id') id: string) {
    return this.savedCourseService.start(user.id, id);
  }

  @Patch(':id/complete')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: '저장 코스 완료 처리',
    description:
      '리뷰나 스탬프가 하나도 없어도 바로 완료(COMPLETED) 처리합니다. 여러 번 호출해도 안전(완료 시각만 갱신). (JWT 필요)',
  })
  @ApiOkResponse({ type: SavedCourseEntityDto })
  complete(@CurrentUser() user: User, @Param('id') id: string) {
    return this.savedCourseService.complete(user.id, id);
  }

  @Patch(':id/uncomplete')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: '저장 코스 완료 취소',
    description:
      '직접 완료 처리한 것만 취소합니다. 이 코스로 작성된 리뷰가 있으면 그 사유로는 여전히 완료 상태로 보일 수 있어요. (JWT 필요)',
  })
  @ApiOkResponse({ type: SavedCourseEntityDto })
  uncomplete(@CurrentUser() user: User, @Param('id') id: string) {
    return this.savedCourseService.uncomplete(user.id, id);
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
