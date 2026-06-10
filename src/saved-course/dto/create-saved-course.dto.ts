import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsObject, IsOptional, IsString, MaxLength } from 'class-validator';
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

  @ApiProperty({
    type: CourseDto,
    description: 'POST /courses/generate 로 받은 코스 객체를 그대로 저장',
  })
  @IsObject()
  course: CourseDto;
}
