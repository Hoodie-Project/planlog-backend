import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiProperty,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { BookmarkService } from './bookmark.service';
import { CreateBookmarkDto } from './dto/create-bookmark.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import type { User } from '../../generated/prisma/client.js';
import { BookmarkType } from '../../generated/prisma/enums.js';

export class BookmarkEntityDto {
  @ApiProperty() id: string;
  @ApiProperty() userId: string;
  @ApiProperty({ enum: BookmarkType }) targetType: BookmarkType;
  @ApiProperty({ description: 'contentId 또는 저장코스 id' }) targetId: string;
  @ApiProperty() title: string;
  @ApiProperty({ nullable: true }) image: string | null;
  @ApiProperty({ nullable: true, description: 'D-Day 기준일' }) dDayDate: Date | null;
  @ApiProperty() createdAt: Date;
}

@ApiTags('찜 (Bookmark)')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('bookmarks')
export class BookmarkController {
  constructor(private readonly bookmarkService: BookmarkService) {}

  @Post()
  @ApiOperation({
    summary: '찜 등록',
    description:
      '축제(FESTIVAL)·관광지(SPOT)·저장코스(COURSE)를 찜합니다. 같은 대상을 다시 보내면 갱신됩니다. dDayDate 를 주면 D-Day 알림 기준이 됩니다. (JWT 필요)',
  })
  @ApiOkResponse({ type: BookmarkEntityDto })
  create(@CurrentUser() user: User, @Body() dto: CreateBookmarkDto) {
    return this.bookmarkService.create(user.id, dto);
  }

  @Get()
  @ApiOperation({ summary: '내 찜 목록', description: 'type 으로 유형 필터. (JWT 필요)' })
  @ApiQuery({ name: 'type', enum: BookmarkType, required: false })
  @ApiOkResponse({ type: [BookmarkEntityDto] })
  findAll(@CurrentUser() user: User, @Query('type') type?: BookmarkType) {
    return this.bookmarkService.findAll(user.id, type);
  }

  @Delete(':id')
  @ApiOperation({ summary: '찜 해제', description: '본인 찜만 삭제. (JWT 필요)' })
  remove(@CurrentUser() user: User, @Param('id') id: string) {
    return this.bookmarkService.remove(user.id, id);
  }
}
