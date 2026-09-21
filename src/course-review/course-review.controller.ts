import { Controller, Get, Query } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CourseReviewService } from './course-review.service';
import { CourseReviewQueryDto } from './dto/course-review-query.dto';
import { CourseReviewSummaryDto } from './dto/course-review.dto';

@ApiTags('코스 후기 (Course Review)')
@Controller('course-reviews')
export class CourseReviewController {
  constructor(private readonly courseReviewService: CourseReviewService) {}

  @Get()
  @ApiOperation({
    summary: '코스 후기 모음 (추천 코스 화면 "코스 후기" 탭)',
    description: [
      '실체는 스탬프 후기 모음 — 추천/저장한 코스에 포함된 관광지들(contentIds)에 대해,',
      '전체 유저 기준으로 감정(mood)까지 남긴 스탬프 리뷰를 모아 반환합니다. 로그인 불필요(공개 조회).',
      '',
      '**입력**: `contentIds`(필수, 쉼표구분) — 코스 결과의 SPOT 항목들의 contentId',
      '',
      '**출력**',
      '- `totalCount`: 전체 후기 개수',
      '- `topMoods`: 가장 많이 남긴 분위기 순(예: 평온함 12건, 설렘 7건 ...)',
      '- `reviews`: 장소별 후기 목록(장소명/방문일/한줄소감/감정), 최신순',
      '',
      '⚠️ 노트만 있고 감정(mood)을 안 남긴 리뷰는 "분위기 집계"용으로 쓸 수 없어 제외됩니다.',
    ].join('\n'),
  })
  @ApiOkResponse({ type: CourseReviewSummaryDto })
  findAll(@Query() query: CourseReviewQueryDto) {
    return this.courseReviewService.getCourseReviews(query.contentIds);
  }
}
