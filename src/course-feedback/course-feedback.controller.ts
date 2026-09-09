import { Body, Controller, Get, HttpCode, HttpStatus, Post, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { CourseFeedbackService } from './course-feedback.service';
import { CreateCourseFeedbackDto } from './dto/create-course-feedback.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import type { User } from '../../generated/prisma/client.js';

@ApiTags('코스 피드백 (Course Feedback)')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('course-feedback')
export class CourseFeedbackController {
  constructor(private readonly courseFeedbackService: CourseFeedbackService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: '코스 피드백 등록',
    description:
      '코스 결과 화면의 프리셋 개선 요청(예: "걷는 시간 줄이기")을 다중 선택해 기록. (JWT 필요)',
  })
  @ApiCreatedResponse({ description: '등록된 피드백' })
  create(@CurrentUser() user: User, @Body() dto: CreateCourseFeedbackDto) {
    return this.courseFeedbackService.create(user.id, dto);
  }

  @Get()
  @ApiOperation({
    summary: '내 코스 피드백 이력',
    description: '최신순. (JWT 필요)',
  })
  @ApiOkResponse({ description: '피드백 목록' })
  findAll(@CurrentUser() user: User) {
    return this.courseFeedbackService.findAll(user.id);
  }
}
