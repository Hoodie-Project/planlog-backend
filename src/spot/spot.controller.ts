import { Controller, Get, Param, Query } from '@nestjs/common';
import {
  ApiExcludeEndpoint,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { SpotService } from './spot.service';
import { LocationSpotQueryDto, ZoneSpotQueryDto } from './dto/spot-query.dto';
import { PlaceDto } from '../common/dto/place.dto';

@ApiTags('관광지 (Spot)')
@Controller('spots')
export class SpotController {
  constructor(private readonly spotService: SpotService) {}

  @Get()
  @ApiOperation({
    summary: '감성존 기반 관광지 조회',
    description: [
      '강원도 지역기반 관광정보(KorService2 areaBasedList2).',
      '',
      '**입력**',
      '- `zone`: 감성존(SEA 동해바다 / SNOW 설원산악 / VALLEY 계곡자연 / RETRO 레트로문화 / PHOTO 절경포토). 생략 시 강원 전체',
      '- `contentTypeId`: 12 관광지 / 14 문화시설 / 28 레포츠 등 (기본 12)',
      '- `numOfRows`(1~50, 기본 12), `pageNo`(기본 1)',
      '',
      '**출력**: PlaceDto 배열 (contentId, 명칭, 주소, 좌표, 대표이미지, 추정 감성존)',
      '',
      '**🔧 가공**: TourAPI 원본 필드 → PlaceDto 정규화(addr1+addr2 결합, 대표이미지 선택) + 관광지명 키워드로 **감성존 자동 분류**(inferZone) + 존 조회 시 시군구 병렬 호출·중복 제거',
    ].join('\n'),
  })
  @ApiOkResponse({ type: [PlaceDto] })
  findByZone(@Query() query: ZoneSpotQueryDto) {
    return this.spotService.findByZone(query);
  }

  @Get('location')
  @ApiOperation({
    summary: '위치기반 관광지 조회 (뚜벅이 동선)',
    description: [
      '좌표 반경 내 관광지(KorService2 locationBasedList2). KTX 역 좌표 + 반경으로 도보권 스팟을 찾습니다.',
      '',
      '**입력**',
      '- `mapX`(경도, 필수), `mapY`(위도, 필수)',
      '- `radius`: 반경(m, 100~20000, 기본 2000)',
      '- `contentTypeId`(선택), `numOfRows`(기본 12)',
      '',
      '**출력**: PlaceDto 배열 (기준 좌표로부터의 거리 `dist`(m) 포함)',
    ].join('\n'),
  })
  @ApiOkResponse({ type: [PlaceDto] })
  findByLocation(@Query() query: LocationSpotQueryDto) {
    return this.spotService.findByLocation(query);
  }

  @Get('area-codes')
  @ApiExcludeEndpoint() // 내부 디버그용 — 프론트 미사용, 문서에서 숨김
  findAreaCodes() {
    return this.spotService.findAreaCodes();
  }

  @Get(':contentId')
  @ApiOperation({
    summary: '관광지 상세 조회',
    description:
      'detailCommon2 공통정보. 코스/목록에서 받은 `contentId`로 상세(개요 overview 포함)를 가져옵니다.',
  })
  @ApiParam({
    name: 'contentId',
    description: 'TourAPI 콘텐츠 ID',
    example: '126508',
  })
  @ApiOkResponse({ type: PlaceDto, description: 'PlaceDto + overview(개요)' })
  findDetail(@Param('contentId') contentId: string) {
    return this.spotService.findDetail(contentId);
  }

  @Get(':contentId/images')
  @ApiOperation({
    summary: '관광지 이미지 목록',
    description: 'detailImage2 — 원본 이미지 URL 배열 (감성 인증 카드 소스).',
  })
  @ApiParam({
    name: 'contentId',
    description: 'TourAPI 콘텐츠 ID',
    example: '126508',
  })
  @ApiOkResponse({ type: [String], description: '이미지 URL 문자열 배열' })
  findImages(@Param('contentId') contentId: string) {
    return this.spotService.findImages(contentId);
  }
}
