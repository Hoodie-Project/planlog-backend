import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class CourseReviewQueryDto {
  @ApiProperty({
    description:
      '코스에 포함된 관광지 contentId 목록(쉼표 구분). POST /courses/generate 응답의 ' +
      'days[].items[]에서 type=SPOT인 항목들의 contentId를 모아서 전달하면 됨.',
    example: '127565,987582,129454',
  })
  @IsString()
  @IsNotEmpty()
  contentIds: string;
}
