import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
} from 'class-validator';
import { Zone } from '../../common/gangwon.constants';

export class SpotCongestionQueryDto {
  @ApiProperty({ description: '감성존(시군구 범위 결정용)', enum: Zone })
  @IsEnum(Zone)
  zone: Zone;

  @ApiProperty({
    description: '관광지명(contentId 없는 데이터라 이름으로 매칭)',
    example: '강릉향교',
  })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiPropertyOptional({
    description: '조회할 날짜(YYYY-MM-DD, 선택). 생략하면 향후 최대 30일 전체',
    example: '2026-10-05',
  })
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'date 는 YYYY-MM-DD 형식이어야 합니다.',
  })
  date?: string;
}
