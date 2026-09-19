import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsNumberString,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { Zone } from '../../common/gangwon.constants';

/** GET /spots/location, /accommodations/location 등에서 고른 후보로 코스 항목 하나를 교체 */
export class ReplaceCourseItemDto {
  @ApiProperty({ description: '교체할 항목이 속한 일자(1부터)', example: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  day: number;

  @ApiProperty({
    description: '교체할 항목의 기존 순서(그 날 동선 내 order, 1부터)',
    example: 2,
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  order: number;

  @ApiProperty({
    description: '교체할 새 장소/숙소의 TourAPI contentId',
    example: '126508',
  })
  @IsString()
  contentId: string;

  @ApiProperty({ description: '명칭', example: '정동진' })
  @IsString()
  title: string;

  @ApiProperty({ description: '경도(X)', example: '129.0334' })
  @IsNumberString()
  mapX: string;

  @ApiProperty({ description: '위도(Y)', example: '37.6907' })
  @IsNumberString()
  mapY: string;

  @ApiPropertyOptional({ description: '주소' })
  @IsOptional()
  @IsString()
  address?: string;

  @ApiPropertyOptional({ description: '대표 이미지 URL' })
  @IsOptional()
  @IsString()
  image?: string;

  @ApiPropertyOptional({
    enum: Zone,
    nullable: true,
    description:
      '감성존(선택). 후보 조회 API 응답의 zone 을 그대로 넘기면 되고, 생략하면 title 기준으로 추정',
  })
  @IsOptional()
  @IsEnum(Zone)
  zone?: Zone;
}
