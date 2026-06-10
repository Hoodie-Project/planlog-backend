import { Controller, Get, Query } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CampingDto, CampingQueryDto, CampingService } from './camping.service';

@ApiTags('캠핑 (Camping)')
@Controller('campings')
export class CampingController {
  constructor(private readonly campingService: CampingService) {}

  @Get()
  @ApiOperation({
    summary: '강원 고캠핑 캠핑장 조회',
    description: [
      '고캠핑 정보 조회서비스(GoCamping basedList)에서 강원도 캠핑장을 제공합니다.',
      '',
      '**입력**',
      '- `petOnly`: `true`면 반려동물 동반 가능 캠핑장만',
      '- `numOfRows`(1~100, 기본 20), `pageNo`(기본 1)',
      '',
      '**출력**: CampingDto 배열 — 야영장명·주소·업종(글램핑/카라반 등)·좌표·반려동물 동반 여부',
      '',
      '**🔧 가공**: 전국 고캠핑 목록에서 **강원도만 필터**(doNm) + CampingDto로 정규화 + `animalCmgCl`로 **반려동물 동반 가능 여부 도출** + petOnly 필터 + 페이징',
    ].join('\n'),
  })
  @ApiOkResponse({ type: [CampingDto] })
  findCampings(@Query() query: CampingQueryDto) {
    return this.campingService.findCampings(query);
  }
}
