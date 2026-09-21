import { ApiProperty } from '@nestjs/swagger';
import { Mood } from '../../common/mood.constants';

export class CourseReviewMoodCountDto {
  @ApiProperty({ enum: Mood, example: Mood.CALM })
  mood: Mood;

  @ApiProperty({ description: '건수', example: 12 })
  count: number;
}

export class CourseReviewItemDto {
  @ApiProperty({ example: '126508' }) contentId: string;
  @ApiProperty({ example: '안목해변' }) title: string;
  @ApiProperty({ description: '스탬프 방문(리뷰) 일자' }) visitedAt: Date;
  @ApiProperty({
    description: '한 줄 소감',
    example: '파도 소리만으로도 충분했던 하루',
  })
  note: string;
  @ApiProperty({ enum: Mood, example: Mood.CALM }) mood: Mood;
}

export class CourseReviewSummaryDto {
  @ApiProperty({ description: '전체 후기 개수', example: 36 })
  totalCount: number;

  @ApiProperty({
    type: [CourseReviewMoodCountDto],
    description: '가장 많이 남긴 분위기 순(건수 내림차순, 0건인 감정은 제외)',
  })
  topMoods: CourseReviewMoodCountDto[];

  @ApiProperty({
    type: [CourseReviewItemDto],
    description: '장소별 후기 목록, 최신순',
  })
  reviews: CourseReviewItemDto[];
}
