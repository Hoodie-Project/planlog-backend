import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  IsArray,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';

export class CreateRecordDto {
  @ApiProperty({ description: '기록 제목', example: '강릉 바다 감성 코스' })
  @IsString()
  @MaxLength(100)
  title: string;

  @ApiProperty({ description: '여행 날짜(YYYY-MM-DD)', example: '2026-07-28' })
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'travelDate 는 YYYY-MM-DD 형식이어야 합니다.',
  })
  travelDate: string;

  @ApiProperty({ description: '방문 지역', example: '강릉' })
  @IsString()
  @MaxLength(50)
  location: string;

  @ApiProperty({
    description: '한 줄 소감',
    example: '파도 소리만으로도 충분했던 하루',
  })
  @IsString()
  @MaxLength(500)
  note: string;

  @ApiPropertyOptional({ description: '오늘의 감정(자유 입력)', example: '평온함' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  mood?: string;

  @ApiPropertyOptional({ description: '대표 이미지 URL' })
  @IsOptional()
  @IsString()
  image?: string;

  @ApiProperty({
    description: '태그(다중)',
    type: [String],
    example: ['바다', '혼자', '카페'],
  })
  @IsArray()
  @ArrayMaxSize(10)
  @IsString({ each: true })
  tags: string[];
}
