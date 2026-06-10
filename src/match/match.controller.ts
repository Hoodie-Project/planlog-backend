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
import { MatchService } from './match.service';
import { OptInDto } from './dto/opt-in.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import type { User } from '../../generated/prisma/client.js';

export class MatchOptInEntityDto {
  @ApiProperty() id: string;
  @ApiProperty() userId: string;
  @ApiProperty({ example: 'SEA' }) zone: string;
  @ApiProperty() travelDate: Date;
  @ApiProperty() createdAt: Date;
}

class MateDto {
  @ApiProperty() id: string;
  @ApiProperty({ example: '게스트_a1b2' }) nickname: string;
  @ApiProperty({ nullable: true }) profileImage: string | null;
}

export class MateGroupDto {
  @ApiProperty({ example: 'SEA' }) zone: string;
  @ApiProperty({ example: '동해 바다존' }) zoneLabel: string;
  @ApiProperty({ example: '2026-06-20' }) travelDate: string;
  @ApiProperty({ type: [MateDto], description: '같은 조건으로 옵트인한 메이트' })
  mates: MateDto[];
}

@ApiTags('동선 매칭 (Match)')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('matches')
export class MatchController {
  constructor(private readonly matchService: MatchService) {}

  @Post('opt-in')
  @ApiOperation({
    summary: '여행 메이트 매칭 옵트인',
    description:
      '동일 감성존·날짜로 여행하는 메이트 매칭에 참여(옵트인)합니다. 옵트인한 사람끼리만 서로 보입니다. (JWT 필요)',
  })
  @ApiOkResponse({ type: MatchOptInEntityDto })
  optIn(@CurrentUser() user: User, @Body() dto: OptInDto) {
    return this.matchService.optIn(user.id, dto);
  }

  @Get('opt-ins')
  @ApiOperation({ summary: '내 옵트인 목록', description: '(JWT 필요)' })
  @ApiOkResponse({ type: [MatchOptInEntityDto] })
  myOptIns(@CurrentUser() user: User) {
    return this.matchService.myOptIns(user.id);
  }

  @Get()
  @ApiOperation({
    summary: '매칭된 여행 메이트 조회',
    description:
      '내가 옵트인한 존·날짜 조합에서, 같은 조건으로 옵트인한 다른 사용자를 보여줍니다. (상호 옵트인) (JWT 필요)',
  })
  @ApiOkResponse({ type: [MateGroupDto] })
  findMates(@CurrentUser() user: User) {
    return this.matchService.findMates(user.id);
  }

  @Delete('opt-ins/:id')
  @ApiOperation({ summary: '옵트인 철회', description: '본인 옵트인만 철회. (JWT 필요)' })
  withdraw(@CurrentUser() user: User, @Param('id') id: string) {
    return this.matchService.withdraw(user.id, id);
  }
}
