import { Controller, Get, Query } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RelatedService, RelatedSpotDto } from './related.service';
import { RelatedQueryDto } from './dto/related-query.dto';

@ApiTags('연관 관광지 (Related)')
@Controller('related-spots')
export class RelatedController {
  constructor(private readonly relatedService: RelatedService) {}

  @Get()
  @ApiOperation({
    summary: '연관 관광지 조회 (스팟 간 연관성)',
    description: [
      '한국관광공사 관광지별 연관 관광지 정보(TarRlteTarService1)를 기반으로 함께 방문되는 관광지를 제공합니다.',
      '',
      '**입력**: `zone`(감성존) 또는 `signguCode`(데이터랩 51xxx) 중 하나 필수, `keyword`(기준 관광지명 필터), `baseYm`(기준연월), `limit`',
      '',
      '**🔧 가공**: 데이터랩 시군구별 연관 쌍을 받아 **기준 관광지(tAtsNm)별로 그룹화** → 연관 관광지를 **연관 순위(rlteRank)순 정렬** + 카테고리/지역 정규화',
      '',
      '**활용**: 코스 동선의 "다음 스팟" 추천, 관광지 상세의 "함께 가볼 곳"',
    ].join('\n'),
  })
  @ApiOkResponse({ type: [RelatedSpotDto] })
  findRelated(@Query() query: RelatedQueryDto) {
    return this.relatedService.findRelated(query);
  }
}
