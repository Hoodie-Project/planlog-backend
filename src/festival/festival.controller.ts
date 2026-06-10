import { Controller, Get, Query } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { FestivalService } from './festival.service';
import { FestivalQueryDto } from './dto/festival-query.dto';
import { FestivalDto } from './dto/festival.dto';

@ApiTags('축제 (Festival)')
@Controller('festivals')
export class FestivalController {
  constructor(private readonly festivalService: FestivalService) {}

  @Get()
  @ApiOperation({
    summary: '주말 HOT 축제 조회',
    description: [
      '강원 행사/축제정보(KorService2 searchFestival2).',
      '',
      '**입력**',
      '- `zone`: 감성존 필터(선택)',
      '- `weekendOnly`: `true`(기본)면 이번 주 금·토·일에 열리는 축제만, `false`면 진행중 전체',
      '- `numOfRows`(1~100, 기본 20)',
      '',
      '**출력**: FestivalDto 배열 — 장소 공통정보 + `eventStartDate`/`eventEndDate`(yyyyMMdd) + `isThisWeekend`.',
      '',
      '**🔧 가공**: 원본 축제 목록을 받아 ① 서버 기준 **이번 주 금~일과 기간이 겹치는지 계산**해 `isThisWeekend` 부여 ② weekendOnly면 주말 축제만 필터 ③ 감성존 태깅 ④ 주말 축제 **상단 정렬**',
    ].join('\n'),
  })
  @ApiOkResponse({ type: [FestivalDto] })
  findFestivals(@Query() query: FestivalQueryDto) {
    return this.festivalService.findFestivals(query);
  }
}
