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

  @ApiPropertyOptional({
    description: '페이지당 개수',
    default: 12,
    minimum: 1,
    maximum: 50,
  })
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

  @ApiPropertyOptional({
    description:
      '결과에서 제외할 contentId 목록(쉼표 구분). 코스에 이미 들어있는 장소를 교체 후보에서 빼고 싶을 때 사용',
    example: '1234567,7654321',
  })
  @IsOptional()
  @IsString()
  excludeContentIds?: string;
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

  @ApiPropertyOptional({
    description:
      '결과에서 제외할 contentId 목록(쉼표 구분). 코스에 이미 들어있는 장소를 교체 후보에서 빼고 싶을 때 사용(지금 교체하려는 장소 자신도 포함해서 보내면 됨)',
    example: '1234567,7654321',
  })
  @IsOptional()
  @IsString()
  excludeContentIds?: string;
}
