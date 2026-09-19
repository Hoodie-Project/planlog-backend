import { Injectable } from '@nestjs/common';
import { TourApiService } from '../tour-api/tour-api.service';
import { TourRawItem } from '../tour-api/tour-api.types';
import {
  ContentType,
  GANGWON_AREA_CODE,
  ZONE_META,
  inferZone,
} from '../common/gangwon.constants';
import { toPlaceDto } from '../common/dto/place.dto';
import {
  AccommodationQueryDto,
  LocationAccommodationQueryDto,
  StayType,
} from './dto/accommodation-query.dto';
import { StayDto } from './dto/stay.dto';

const KOR_SERVICE = 'KorService2';

/** searchStay2 응답의 숙박 분류 필드(있을 때 활용) */
interface StayRawItem extends TourRawItem {
  cat3?: string;
}

@Injectable()
export class AccommodationService {
  constructor(private readonly tourApi: TourApiService) {}

  async findStays(query: AccommodationQueryDto): Promise<StayDto[]> {
    const sigunguCodes: (string | undefined)[] = query.zone
      ? ZONE_META[query.zone].sigunguCodes
      : [undefined];

    const results = await Promise.all(
      sigunguCodes.map((code) =>
        this.searchStay(code, query.numOfRows, query.pageNo),
      ),
    );

    let stays: StayDto[] = this.dedupe(results.flat()).map((raw) => ({
      ...toPlaceDto(raw),
      zone: query.zone ?? inferZone(raw.title, raw.sigungucode),
      stayType: this.classify(raw),
    }));

    if (query.type) {
      stays = stays.filter((s) => s.stayType === query.type);
    }
    return this.excludeIds(stays, query.excludeContentIds);
  }

  /**
   * 좌표 근처 숙소(코스의 특정 지점 근처로 숙소를 "교체"할 때 사용).
   * TourAPI locationBasedList2 를 숙박(contentTypeId=32)로 조회 — 거리순(dist 포함).
   */
  async findStaysByLocation(
    query: LocationAccommodationQueryDto,
  ): Promise<StayDto[]> {
    const { items } = await this.tourApi.getList<StayRawItem>(
      KOR_SERVICE,
      'locationBasedList2',
      {
        mapX: query.mapX,
        mapY: query.mapY,
        radius: query.radius,
        contentTypeId: ContentType.STAY,
        numOfRows: query.numOfRows,
        arrange: 'E', // 거리순(이미지 있는 항목 우선)
      },
    );

    let stays: StayDto[] = items.map((raw) => ({
      ...toPlaceDto(raw),
      zone: inferZone(raw.title, raw.sigungucode),
      stayType: this.classify(raw),
    }));

    if (query.type) {
      stays = stays.filter((s) => s.stayType === query.type);
    }
    return this.excludeIds(stays, query.excludeContentIds);
  }

  /** excludeContentIds(쉼표 구분 문자열)에 해당하는 항목 제외 */
  private excludeIds(stays: StayDto[], excludeContentIds?: string): StayDto[] {
    if (!excludeContentIds) return stays;
    const excluded = new Set(
      excludeContentIds
        .split(',')
        .map((id) => id.trim())
        .filter(Boolean),
    );
    return stays.filter((s) => !excluded.has(s.contentId));
  }

  /**
   * 숙소명/분류코드 휴리스틱으로 혼행 4유형 분류.
   * (정밀 분류는 detailIntro2 의 객실수·편의시설 데이터로 고도화 예정)
   */
  private classify(raw: StayRawItem): StayType {
    const t = raw.title ?? '';
    if (/캠핑|글램핑|카라반|오토캠핑/.test(t)) return StayType.CAMPING;
    if (/게스트하우스|호스텔|게하|GH/i.test(t)) return StayType.SOCIAL;
    if (/펜션|풀빌라|리조트|스테이|한옥/.test(t)) return StayType.HEALING;
    if (/모텔|여관|민박|호텔/.test(t)) return StayType.VALUE;
    return StayType.VALUE;
  }

  private async searchStay(
    sigunguCode: string | undefined,
    numOfRows?: number,
    pageNo?: number,
  ): Promise<StayRawItem[]> {
    const { items } = await this.tourApi.getList<StayRawItem>(
      KOR_SERVICE,
      'searchStay2',
      {
        areaCode: GANGWON_AREA_CODE,
        sigunguCode,
        numOfRows,
        pageNo,
        arrange: 'O',
      },
    );
    return items;
  }

  private dedupe(items: StayRawItem[]): StayRawItem[] {
    const seen = new Set<string>();
    return items.filter((it) => {
      if (seen.has(it.contentid)) return false;
      seen.add(it.contentid);
      return true;
    });
  }
}
