import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  IsArray,
  IsEnum,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';
import { Zone } from '../../common/gangwon.constants';
import { Mood } from '../../common/mood.constants';

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
    enum: Zone,
    description:
      '이 리뷰가 속한 코스의 감성존. "나의 기록" 여행 성향 집계에 사용.',
    example: Zone.SEA,
  })
  @IsEnum(Zone)
  zone: Zone;

  @ApiProperty({
    description: '한 줄 소감',
    example: '파도 소리만으로도 충분했던 하루',
  })
  @IsString()
  @MaxLength(500)
  note: string;

  @ApiPropertyOptional({
    enum: Mood,
    description: '오늘의 감정(고정 8종 중 1개, "리뷰하기" 모달 감정 선택)',
    example: Mood.CALM,
  })
  @IsOptional()
  @IsEnum(Mood)
  mood?: Mood;

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

  @ApiPropertyOptional({
    description:
      '이 기록의 근거가 된 저장 코스 ID(선택). 지정하면 코스의 방문 장소 수/총 이동거리/박수를 스냅샷으로 함께 저장합니다.',
  })
  @IsOptional()
  @IsString()
  savedCourseId?: string;

  @ApiPropertyOptional({
    description:
      '이 기록에서 획득한 것으로 표시할 스탬프 ID 목록(선택, 본인 스탬프만 연결 가능)',
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  stampIds?: string[];
}
