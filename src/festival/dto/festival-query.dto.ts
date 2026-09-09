import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBooleanString,
  IsEnum,
  IsInt,
  IsOptional,
  Max,
  Min,
} from 'class-validator';
import { Zone } from '../../common/gangwon.constants';

export class FestivalQueryDto {
  @ApiPropertyOptional({
    description: '감성존 필터 (생략 시 강원 전체)',
    enum: Zone,
  })
  @IsOptional()
  @IsEnum(Zone)
  zone?: Zone;

  @ApiPropertyOptional({
    description: 'true 면 이번 주 금·토·일에 열리는 축제만 (주말 HOT)',
    default: true,
  })
  @IsOptional()
  @IsBooleanString()
  weekendOnly?: string;

  @ApiPropertyOptional({ description: '페이지당 개수', default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  numOfRows?: number = 20;
}
