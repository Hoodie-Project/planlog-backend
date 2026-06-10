import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';
import { BookmarkType } from '../../../generated/prisma/enums.js';

export class CreateBookmarkDto {
  @ApiProperty({
    enum: BookmarkType,
    description: 'FESTIVAL/SPOT=TourAPI contentId, COURSE=저장코스 id',
  })
  @IsEnum(BookmarkType)
  targetType: BookmarkType;

  @ApiProperty({ description: '대상 식별자', example: '126508' })
  @IsString()
  targetId: string;

  @ApiProperty({ description: '표시용 제목(스냅샷)', example: '강릉 커피축제' })
  @IsString()
  @MaxLength(150)
  title: string;

  @ApiPropertyOptional({ description: '대표 이미지 URL' })
  @IsOptional()
  @IsString()
  image?: string;

  @ApiPropertyOptional({
    description: 'D-Day 알림 기준일(YYYY-MM-DD). 축제 시작일 등',
    example: '2026-06-13',
  })
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'dDayDate 는 YYYY-MM-DD 형식이어야 합니다.' })
  dDayDate?: string;
}
