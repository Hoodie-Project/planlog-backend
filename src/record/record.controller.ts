import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiProperty,
  ApiTags,
} from '@nestjs/swagger';
import { RecordService } from './record.service';
import { CreateRecordDto } from './dto/create-record.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import type { User } from '../../generated/prisma/client.js';

export class RecordEntityDto {
  @ApiProperty() id: string;
  @ApiProperty() userId: string;
  @ApiProperty() title: string;
  @ApiProperty() travelDate: Date;
  @ApiProperty() location: string;
  @ApiProperty() note: string;
  @ApiProperty({ nullable: true }) mood: string | null;
  @ApiProperty({ nullable: true }) image: string | null;
  @ApiProperty({ type: [String] }) tags: string[];
  @ApiProperty() createdAt: Date;
}

@ApiTags('여행 기록 카드 (Record)')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('records')
export class RecordController {
  constructor(private readonly recordService: RecordService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: '기록 카드 작성',
    description:
      '다녀온 여행에 대한 짧은 기록(제목/날짜/지역/한줄소감/태그)을 남깁니다. (JWT 필요)',
  })
  @ApiCreatedResponse({ type: RecordEntityDto })
  create(@CurrentUser() user: User, @Body() dto: CreateRecordDto) {
    return this.recordService.create(user.id, dto);
  }

  @Get()
  @ApiOperation({
    summary: '내 기록 카드 목록',
    description: '여행 날짜 최신순. (JWT 필요)',
  })
  @ApiOkResponse({ type: [RecordEntityDto] })
  findAll(@CurrentUser() user: User) {
    return this.recordService.findAll(user.id);
  }

  @Get(':id')
  @ApiOperation({ summary: '기록 카드 상세', description: '(JWT 필요)' })
  @ApiOkResponse({ type: RecordEntityDto })
  findOne(@CurrentUser() user: User, @Param('id') id: string) {
    return this.recordService.findOne(user.id, id);
  }

  @Delete(':id')
  @ApiOperation({ summary: '기록 카드 삭제', description: '본인 기록만 삭제. (JWT 필요)' })
  remove(@CurrentUser() user: User, @Param('id') id: string) {
    return this.recordService.remove(user.id, id);
  }
}
