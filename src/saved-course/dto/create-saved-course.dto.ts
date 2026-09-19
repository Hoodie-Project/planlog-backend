import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsObject,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';
import { CourseDto } from '../../course/dto/course.dto';

export class CreateSavedCourseDto {
  @ApiPropertyOptional({
    description: '코스 제목(생략 시 코스 요약을 사용)',
    example: '속초 뚜벅이 당일치기',
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  title?: string;

  @ApiPropertyOptional({
    description:
      '여행 날짜(YYYY-MM-DD, 선택). 생략하면 코스 생성 시 준 travelDate(혼잡도 조회용)를 대신 사용. "다가오는 여행" D-Day 및 저장한 코스 상태 계산에 쓰임',
    example: '2026-08-10',
  })
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'travelDate 는 YYYY-MM-DD 형식이어야 합니다.',
  })
  travelDate?: string;

  @ApiProperty({
    type: CourseDto,
    description: 'POST /courses/generate 로 받은 코스 객체를 그대로 저장',
  })
  @IsObject()
  course: CourseDto;
}
