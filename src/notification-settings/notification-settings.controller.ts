import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { NotificationSettingsService } from './notification-settings.service';
import { NotificationSettingsDto } from './dto/notification-settings.dto';
import { UpdateNotificationSettingsDto } from './dto/update-notification-settings.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import type { User } from '../../generated/prisma/client.js';

@ApiTags('알림 설정 (Notification Settings)')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('notification-settings')
export class NotificationSettingsController {
  constructor(
    private readonly notificationSettingsService: NotificationSettingsService,
  ) {}

  @Get()
  @ApiOperation({
    summary: '내 알림 설정 조회',
    description: '설정이 없으면 기본값(전부 ON)으로 생성 후 반환. (JWT 필요)',
  })
  @ApiOkResponse({ type: NotificationSettingsDto })
  findOne(@CurrentUser() user: User) {
    return this.notificationSettingsService.findOne(user.id);
  }

  @Patch()
  @ApiOperation({
    summary: '알림 설정 변경',
    description: '보낸 필드만 갱신. (JWT 필요)',
  })
  @ApiOkResponse({ type: NotificationSettingsDto })
  update(
    @CurrentUser() user: User,
    @Body() dto: UpdateNotificationSettingsDto,
  ) {
    return this.notificationSettingsService.update(user.id, dto);
  }
}
