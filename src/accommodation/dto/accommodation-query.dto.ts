import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsNumberString,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
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

  @ApiPropertyOptional({
    description:
      '결과에서 제외할 contentId 목록(쉼표 구분). 코스에 이미 들어있는 숙소를 교체 후보에서 빼고 싶을 때 사용',
    example: '1234567,7654321',
  })
  @IsOptional()
  @IsString()
  excludeContentIds?: string;
}

export class LocationAccommodationQueryDto {
  @ApiPropertyOptional({ description: '경도(X)', example: '128.8961' })
  @IsNumberString()
  mapX: string;

  @ApiPropertyOptional({ description: '위도(Y)', example: '37.7649' })
  @IsNumberString()
  mapY: string;

  @ApiPropertyOptional({
    description: '반경(m). 코스의 교체 대상 숙소/스팟 근처를 찾을 때 사용',
    default: 5000,
    minimum: 100,
    maximum: 20000,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(100)
  @Max(20000)
  radius?: number = 5000;

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

  @ApiPropertyOptional({
    description:
      '결과에서 제외할 contentId 목록(쉼표 구분). 코스에 이미 들어있는 숙소를 교체 후보에서 빼고 싶을 때 사용',
    example: '1234567,7654321',
  })
  @IsOptional()
  @IsString()
  excludeContentIds?: string;
}
