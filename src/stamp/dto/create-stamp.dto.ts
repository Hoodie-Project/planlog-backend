import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
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
}
