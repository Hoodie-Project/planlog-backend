import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsNumberString,
  IsOptional,
  Max,
  Min,
} from 'class-validator';
import { ContentType, Zone } from '../../common/gangwon.constants';

export class ZoneSpotQueryDto {
  @ApiPropertyOptional({
    description: '감성존 필터 (생략 시 강원 전체)',
    enum: Zone,
  })
  @IsOptional()
  @IsEnum(Zone)
  zone?: Zone;

  @ApiPropertyOptional({
    description: 'TourAPI contentTypeId (12=관광지, 14=문화시설, 28=레포츠 등)',
    enum: ContentType,
    default: ContentType.TOURIST_SPOT,
  })
  @IsOptional()
  @IsEnum(ContentType)
  contentTypeId?: ContentType = ContentType.TOURIST_SPOT;

  @ApiPropertyOptional({ description: '페이지당 개수', default: 12, minimum: 1, maximum: 50 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  numOfRows?: number = 12;

  @ApiPropertyOptional({ description: '페이지 번호', default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  pageNo?: number = 1;
}

export class LocationSpotQueryDto {
  @ApiPropertyOptional({ description: '경도(X)', example: '128.8784' })
  @IsNumberString()
  mapX: string;

  @ApiPropertyOptional({ description: '위도(Y)', example: '37.7519' })
  @IsNumberString()
  mapY: string;

  @ApiPropertyOptional({
    description: '반경(m). 뚜벅이 동선 기본 도보권',
    default: 2000,
    minimum: 100,
    maximum: 20000,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(100)
  @Max(20000)
  radius?: number = 2000;

  @ApiPropertyOptional({
    description: 'TourAPI contentTypeId',
    enum: ContentType,
  })
  @IsOptional()
  @IsEnum(ContentType)
  contentTypeId?: ContentType;

  @ApiPropertyOptional({ description: '페이지당 개수', default: 12 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  numOfRows?: number = 12;
}
