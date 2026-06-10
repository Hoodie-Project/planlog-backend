import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  Min,
} from 'class-validator';
import { Zone } from '../../common/gangwon.constants';

export class RelatedQueryDto {
  @ApiPropertyOptional({
    description: '감성존 (해당 존의 데이터랩 시군구들을 조회). zone 또는 signguCode 중 하나 필요',
    enum: Zone,
  })
  @IsOptional()
  @IsEnum(Zone)
  zone?: Zone;

  @ApiPropertyOptional({
    description: '데이터랩 행정 시군구 코드(강원 51xxx). 예: 51150 강릉',
    example: '51150',
  })
  @IsOptional()
  @IsString()
  signguCode?: string;

  @ApiPropertyOptional({
    description: '기준 관광지명 필터(부분일치). 특정 관광지의 연관 관광지만 보고 싶을 때',
    example: '오죽헌',
  })
  @IsOptional()
  @IsString()
  keyword?: string;

  @ApiPropertyOptional({
    description: '기준연월(YYYYMM). 생략 시 최근 가용 월',
    example: '202504',
  })
  @IsOptional()
  @Matches(/^\d{6}$/, { message: 'baseYm 은 YYYYMM 형식이어야 합니다.' })
  baseYm?: string;

  @ApiPropertyOptional({ description: '기준 관광지 최대 개수', default: 10, minimum: 1, maximum: 30 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(30)
  limit?: number = 10;
}
