import { ApiProperty } from '@nestjs/swagger';

export class NotificationSettingsDto {
  @ApiProperty({ description: 'D-Day 알림', example: true })
  ddayAlert: boolean;

  @ApiProperty({ description: '축제 알림', example: true })
  festivalAlert: boolean;

  @ApiProperty({ description: '코스 리마인드', example: true })
  courseReminder: boolean;
}
