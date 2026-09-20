import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsNumberString,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { Zone } from '../../common/gangwon.constants';

export class CreateStampDto {
  @ApiProperty({ enum: Zone, description: '방문한 관광지의 감성존' })
  @IsEnum(Zone)
  zone: Zone;

  @ApiProperty({
    description: '방문 관광지 TourAPI contentId',
    example: '126508',
  })
  @IsString()
  contentId: string;

  @ApiProperty({ description: '관광지명(스냅샷)', example: '정동진' })
  @IsString()
  @MaxLength(150)
  title: string;

  @ApiPropertyOptional({ description: '대표 이미지 URL' })
  @IsOptional()
  @IsString()
  image?: string;

  @ApiPropertyOptional({
    description:
      '현재 위치 경도(X). 이 관광지 좌표로부터 2km 이내여야 스탬프가 인정됨(심사자 계정 제외). 생략하면 위치 권한 미허용으로 간주해 거부됨',
    example: '129.0334',
  })
  @IsOptional()
  @IsNumberString()
  curMapX?: string;

  @ApiPropertyOptional({ description: '현재 위치 위도(Y)', example: '37.6907' })
  @IsOptional()
  @IsNumberString()
  curMapY?: string;
}
