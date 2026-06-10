import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, Max, Min } from 'class-validator';
import { ContentType, Zone } from '../../common/gangwon.constants';

export class PetQueryDto {
  @ApiPropertyOptional({ description: '감성존 필터', enum: Zone })
  @IsOptional()
  @IsEnum(Zone)
  zone?: Zone;

  @ApiPropertyOptional({
    description: 'TourAPI contentTypeId (12=관광지, 39=음식점, 32=숙박 등)',
    enum: ContentType,
  })
  @IsOptional()
  @IsEnum(ContentType)
  contentTypeId?: ContentType;

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
