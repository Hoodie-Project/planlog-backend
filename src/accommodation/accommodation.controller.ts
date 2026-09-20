import { Controller, Get, Param, Query } from '@nestjs/common';
import {
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiProperty,
  ApiTags,
} from '@nestjs/swagger';
import { AccommodationService } from './accommodation.service';
import {
  AccommodationQueryDto,
  LocationAccommodationQueryDto,
} from './dto/accommodation-query.dto';
import { StayDto } from './dto/stay.dto';
import { StayIntroDto } from './dto/stay-intro.dto';

export class StayDetailDto extends StayDto {
  @ApiProperty({ description: '숙소 개요(설명)' })
  overview?: string;

  @ApiProperty({
    type: StayIntroDto,
    description: '이용정보(체크인/아웃, 객실 수, 부대시설 등)',
  })
  intro?: StayIntroDto;
}

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
      '- `excludeContentIds`(선택, 쉼표구분): 이미 코스에 들어있는 숙소 제외',
      '',
      '**출력**: StayDto 배열 — 장소 공통정보 + `stayType`(4유형)',
      '',
      '**🔧 가공**: 시군구별 숙박 목록을 병렬 호출·병합 후 숙소명 패턴으로 **혼행 4유형 분류**(게스트하우스→교류형, 펜션/풀빌라→감성힐링, 캠핑→캠핑, 그 외→가성비)',
    ].join('\n'),
  })
  @ApiOkResponse({ type: [StayDto] })
  findStays(@Query() query: AccommodationQueryDto) {
    return this.accommodationService.findStays(query);
  }

  @Get('location')
  @ApiOperation({
    summary: '좌표 근처 숙소 조회 (코스 숙박 교체용)',
    description: [
      '코스의 특정 지점(예: 교체하려는 숙소나 마지막 스팟) 근처 숙소를 거리순으로 조회합니다.',
      'KorService2 locationBasedList2 를 숙박(contentTypeId=32)으로 호출.',
      '',
      '**입력**',
      '- `mapX`(경도), `mapY`(위도) — 필수',
      '- `radius`: 반경(m, 100~20000, 기본 5000)',
      '- `type`: 숙소 유형 필터(선택)',
      '- `excludeContentIds`(선택, 쉼표구분): 이미 코스에 들어있는 숙소 제외(지금 교체하려는 숙소 자신도 포함해서 보내면 됨)',
      '',
      '**출력**: StayDto 배열 — 기준 좌표로부터의 거리 `dist`(m) 포함, 가까운 순',
    ].join('\n'),
  })
  @ApiOkResponse({ type: [StayDto] })
  findStaysByLocation(@Query() query: LocationAccommodationQueryDto) {
    return this.accommodationService.findStaysByLocation(query);
  }

  @Get(':contentId')
  @ApiOperation({
    summary: '숙소 상세 조회',
    description: [
      'detailCommon2(공통정보) + detailIntro2(숙박 특화 이용정보)를 합쳐서 반환합니다.',
      '관광지 상세(`GET /spots/{contentId}`)와 API가 달라 필드 구성이 다릅니다 — 숙소는 체크인/체크아웃 시각, 객실 수, 부대시설 목록 등을 포함.',
    ].join('\n'),
  })
  @ApiParam({
    name: 'contentId',
    description: 'TourAPI 콘텐츠 ID',
    example: '2892217',
  })
  @ApiOkResponse({ type: StayDetailDto })
  findDetail(@Param('contentId') contentId: string) {
    return this.accommodationService.findDetail(contentId);
  }
}
