import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional } from 'class-validator';

export class UpdateNotificationSettingsDto {
  @ApiPropertyOptional({ description: 'D-Day 알림' })
  @IsOptional()
  @IsBoolean()
  ddayAlert?: boolean;

  @ApiPropertyOptional({ description: '축제 알림' })
  @IsOptional()
  @IsBoolean()
  festivalAlert?: boolean;

  @ApiPropertyOptional({ description: '코스 리마인드' })
  @IsOptional()
  @IsBoolean()
  courseReminder?: boolean;
}
