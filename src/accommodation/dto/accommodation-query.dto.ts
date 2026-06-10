import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, Max, Min } from 'class-validator';
import { Zone } from '../../common/gangwon.constants';

/** 혼행 맞춤 숙소 4유형 */
export enum StayType {
  VALUE = 'VALUE', // 가성비
  SOCIAL = 'SOCIAL', // 교류형 (게스트하우스 등)
  HEALING = 'HEALING', // 감성힐링 (펜션/풀빌라)
  CAMPING = 'CAMPING', // 캠핑/글램핑
}

export class AccommodationQueryDto {
  @ApiPropertyOptional({ description: '감성존 필터', enum: Zone })
  @IsOptional()
  @IsEnum(Zone)
  zone?: Zone;

  @ApiPropertyOptional({ description: '숙소 유형 필터', enum: StayType })
  @IsOptional()
  @IsEnum(StayType)
  type?: StayType;

  @ApiPropertyOptional({ description: '페이지당 개수', default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  numOfRows?: number = 20;

  @ApiPropertyOptional({ description: '페이지 번호', default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  pageNo?: number = 1;
}
