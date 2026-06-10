import { Controller, Get, Query } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AccommodationService } from './accommodation.service';
import { AccommodationQueryDto } from './dto/accommodation-query.dto';
import { StayDto } from './dto/stay.dto';

@ApiTags('숙소 (Accommodation)')
@Controller('accommodations')
export class AccommodationController {
  constructor(private readonly accommodationService: AccommodationService) {}

  @Get()
  @ApiOperation({
    summary: '혼행 맞춤 숙소 조회',
    description: [
      '강원 숙박정보(KorService2 searchStay2)를 혼행 4유형으로 분류해 제공합니다.',
      '',
      '**입력**',
      '- `zone`: 감성존 필터(선택)',
      '- `type`: 숙소 유형 필터 — VALUE(가성비) / SOCIAL(교류형) / HEALING(감성힐링) / CAMPING(캠핑)',
      '- `numOfRows`(1~100, 기본 20), `pageNo`(기본 1)',
      '',
      '**출력**: StayDto 배열 — 장소 공통정보 + `stayType`(4유형)',
      '',
      '**🔧 가공**: 시군구별 숙박 목록을 병렬 호출·병합 후 ① 숙소명 패턴으로 **혼행 4유형 분류**(게스트하우스→교류형, 펜션/풀빌라→감성힐링, 캠핑→캠핑, 그 외→가성비) ② PET 스타일이면 펜션·캠핑 위주 가중',
    ].join('\n'),
  })
  @ApiOkResponse({ type: [StayDto] })
  findStays(@Query() query: AccommodationQueryDto) {
    return this.accommodationService.findStays(query);
  }
}
