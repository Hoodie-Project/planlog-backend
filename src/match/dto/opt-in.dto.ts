import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, Matches } from 'class-validator';
import { Zone } from '../../common/gangwon.constants';

export class OptInDto {
  @ApiProperty({ enum: Zone, description: '여행할 감성존' })
  @IsEnum(Zone)
  zone: Zone;

  @ApiProperty({ description: '여행 날짜(YYYY-MM-DD)', example: '2026-06-20' })
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'travelDate 는 YYYY-MM-DD 형식이어야 합니다.' })
  travelDate: string;
}
