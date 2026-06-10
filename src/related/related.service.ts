import { BadRequestException, Injectable } from '@nestjs/common';
import { ApiProperty } from '@nestjs/swagger';
import { TourApiService } from '../tour-api/tour-api.service';
import { Zone, ZONE_DL_SIGUNGU } from '../common/gangwon.constants';
import { RelatedQueryDto } from './dto/related-query.dto';

const TARRLTE_SERVICE = 'TarRlteTarService1';

/** 이름 매칭용 정규화 — 공백/괄호/슬래시/기호 제거 후 소문자 */
export function normalizeSpotName(s: string): string {
  return (s || '')
    .replace(/\([^)]*\)/g, '')
    .replace(/[\s/()·,.\-_'"]/g, '')
    .toLowerCase();
}

/** TarRlteTarService1 areaBasedList1 응답 행 */
interface RelatedRawItem {
  tAtsCd: string;
  tAtsNm: string; // 기준 관광지명
  signguNm: string;
  rlteTatsNm: string; // 연관 관광지명
  rlteRegnNm: string;
  rlteSignguNm: string;
  rlteCtgryLclsNm: string;
  rlteCtgryMclsNm: string;
  rlteRank: string;
}

export class RelatedItemDto {
  @ApiProperty({ example: '주문진수산시장' }) name: string;
  @ApiProperty({ example: '쇼핑', description: '카테고리(중분류 우선)' }) category: string;
  @ApiProperty({ example: '강원특별자치도 강릉시' }) region: string;
  @ApiProperty({ example: 1, description: '연관 순위(낮을수록 강함)' }) rank: number;
}

export class RelatedSpotDto {
  @ApiProperty({ example: '오죽헌', description: '기준 관광지' }) baseSpot: string;
  @ApiProperty({ example: '강릉시' }) sigungu: string;
  @ApiProperty({ type: [RelatedItemDto], description: '연관 관광지(순위순)' })
  related: RelatedItemDto[];
}

@Injectable()
export class RelatedService {
  constructor(private readonly tourApi: TourApiService) {}

  /**
   * 감성존/시군구 기준 연관 관광지 조회 (스팟 간 연관성).
   * 기준 관광지별로 연관 관광지를 순위순으로 묶어 반환.
   */
  async findRelated(query: RelatedQueryDto): Promise<RelatedSpotDto[]> {
    const codes = this.resolveSigunguCodes(query);
    const baseYm = query.baseYm ?? this.defaultBaseYm();

    const results = await Promise.all(
      codes.map((code) => this.fetchRegion(code, baseYm)),
    );
    const rows = results.flat();

    const keyword = query.keyword?.trim();
    const filtered = keyword
      ? rows.filter((r) => r.tAtsNm?.includes(keyword))
      : rows;

    return this.groupByBase(filtered, query.limit ?? 10);
  }

  /**
   * 코스 동선용: zone 의 (정규화된 기준 관광지명 → 연관 관광지명 배열, rank순) 맵.
   * 코스 생성 시 1회 조회해 두고 풀의 관광지 이름과 매칭한다.
   */
  async getRelatedMap(
    zone: Zone,
    baseYm?: string,
  ): Promise<Map<string, string[]>> {
    const codes = ZONE_DL_SIGUNGU[zone];
    const ym = baseYm ?? this.defaultBaseYm();
    const results = await Promise.all(
      codes.map((code) => this.fetchRegionWide(code, ym)),
    );
    const tmp = new Map<string, { name: string; rank: number }[]>();
    for (const r of results.flat()) {
      if (!r.tAtsNm || !r.rlteTatsNm) continue;
      const key = normalizeSpotName(r.tAtsNm);
      const arr = tmp.get(key) ?? [];
      arr.push({ name: r.rlteTatsNm, rank: Number(r.rlteRank) || 999 });
      tmp.set(key, arr);
    }
    const out = new Map<string, string[]>();
    for (const [k, arr] of tmp) {
      arr.sort((a, b) => a.rank - b.rank);
      out.set(k, arr.map((x) => x.name));
    }
    return out;
  }

  private resolveSigunguCodes(query: RelatedQueryDto): string[] {
    if (query.signguCode) return [query.signguCode];
    if (query.zone) return ZONE_DL_SIGUNGU[query.zone as Zone];
    throw new BadRequestException('zone 또는 signguCode 중 하나는 필요합니다.');
  }

  private async fetchRegion(
    signguCd: string,
    baseYm: string,
  ): Promise<RelatedRawItem[]> {
    const { items } = await this.tourApi.getList<RelatedRawItem>(
      TARRLTE_SERVICE,
      'areaBasedList1',
      {
        baseYm,
        areaCd: '51', // 강원특별자치도
        signguCd,
        numOfRows: 500,
        pageNo: 1,
      },
    );
    return items;
  }

  /** 코스 매핑용 — 더 넓은 기준 관광지 커버 위해 많이 가져온다 */
  private async fetchRegionWide(
    signguCd: string,
    baseYm: string,
  ): Promise<RelatedRawItem[]> {
    const { items } = await this.tourApi.getList<RelatedRawItem>(
      TARRLTE_SERVICE,
      'areaBasedList1',
      { baseYm, areaCd: '51', signguCd, numOfRows: 1500, pageNo: 1 },
    );
    return items;
  }

  /** 기준 관광지(tAtsNm)별로 연관 관광지를 순위순으로 그룹화 */
  private groupByBase(rows: RelatedRawItem[], limit: number): RelatedSpotDto[] {
    const map = new Map<string, RelatedSpotDto>();
    for (const r of rows) {
      if (!r.tAtsNm || !r.rlteTatsNm) continue;
      let group = map.get(r.tAtsNm);
      if (!group) {
        group = { baseSpot: r.tAtsNm, sigungu: r.signguNm, related: [] };
        map.set(r.tAtsNm, group);
      }
      group.related.push({
        name: r.rlteTatsNm,
        category: r.rlteCtgryMclsNm || r.rlteCtgryLclsNm || '',
        region: [r.rlteRegnNm, r.rlteSignguNm].filter(Boolean).join(' '),
        rank: Number(r.rlteRank) || 999,
      });
    }
    const groups = [...map.values()].slice(0, limit);
    for (const g of groups) {
      g.related.sort((a, b) => a.rank - b.rank);
    }
    return groups;
  }

  /** 데이터 가용성 고려해 약 2개월 전을 기본 기준연월로 */
  private defaultBaseYm(): string {
    const d = new Date();
    d.setMonth(d.getMonth() - 2);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    return `${y}${m}`;
  }
}
