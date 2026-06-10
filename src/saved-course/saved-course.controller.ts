import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiProperty,
  ApiTags,
} from '@nestjs/swagger';
import { SavedCourseService } from './saved-course.service';
import { CreateSavedCourseDto } from './dto/create-saved-course.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import type { User } from '../../generated/prisma/client.js';

export class SavedCourseEntityDto {
  @ApiProperty({ example: 'cmq7x...' }) id: string;
  @ApiProperty() userId: string;
  @ApiProperty({ example: '속초 뚜벅이 당일치기' }) title: string;
  @ApiProperty({ example: 'SEA' }) zone: string;
  @ApiProperty({ example: 0 }) nights: number;
  @ApiProperty({ description: '저장된 코스(CourseDto) 스냅샷', type: 'object', additionalProperties: true })
  payload: Record<string, unknown>;
  @ApiProperty() createdAt: Date;
}

@ApiTags('내 코스 (Saved Course)')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('saved-courses')
export class SavedCourseController {
  constructor(private readonly savedCourseService: SavedCourseService) {}

  @Post()
  @ApiOperation({
    summary: '코스 저장',
    description:
      'POST /courses/generate 로 받은 코스 객체를 그대로 보내 저장합니다. (JWT 필요) 관광 원본은 contentId 참조이므로 코스 스냅샷만 DB에 저장됩니다.',
  })
  @ApiOkResponse({ type: SavedCourseEntityDto })
  create(@CurrentUser() user: User, @Body() dto: CreateSavedCourseDto) {
    return this.savedCourseService.create(user.id, dto);
  }

  @Get()
  @ApiOperation({ summary: '내 저장 코스 목록', description: '최신순. (JWT 필요)' })
  @ApiOkResponse({ type: [SavedCourseEntityDto] })
  findAll(@CurrentUser() user: User) {
    return this.savedCourseService.findAll(user.id);
  }

  @Get(':id')
  @ApiOperation({ summary: '저장 코스 상세', description: 'payload 에 코스 전체가 들어있음. (JWT 필요)' })
  @ApiOkResponse({ type: SavedCourseEntityDto })
  findOne(@CurrentUser() user: User, @Param('id') id: string) {
    return this.savedCourseService.findOne(user.id, id);
  }

  @Delete(':id')
  @ApiOperation({ summary: '저장 코스 삭제', description: '본인 코스만 삭제. (JWT 필요)' })
  remove(@CurrentUser() user: User, @Param('id') id: string) {
    return this.savedCourseService.remove(user.id, id);
  }
}
