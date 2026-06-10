import { Injectable } from '@nestjs/common';
import { TourApiService } from '../tour-api/tour-api.service';
import { TourRawItem } from '../tour-api/tour-api.types';
import {
  ContentType,
  GANGWON_AREA_CODE,
  Zone,
  ZONE_META,
} from '../common/gangwon.constants';
import { PlaceDto, toPlaceDto } from '../common/dto/place.dto';
import { LocationSpotQueryDto, ZoneSpotQueryDto } from './dto/spot-query.dto';

const KOR_SERVICE = 'KorService2';

@Injectable()
export class SpotService {
  constructor(private readonly tourApi: TourApiService) {}

  /** 감성존(또는 강원 전체) 지역기반 관광지 조회 */
  async findByZone(query: ZoneSpotQueryDto): Promise<PlaceDto[]> {
    const { zone, contentTypeId, numOfRows, pageNo } = query;

    // 감성존이 지정되면 해당 시군구들을 병렬 조회 후 병합, 아니면 강원 전체 1회 조회.
    if (zone) {
      const codes = ZONE_META[zone].sigunguCodes;
      const results = await Promise.all(
        codes.map((code) =>
          this.areaBasedList(contentTypeId, numOfRows, pageNo, code),
        ),
      );
      return this.dedupe(results.flat()).map((it) => ({
        ...toPlaceDto(it),
        zone, // 존 조회 결과는 해당 존으로 확정 태깅
      }));
    }

    const items = await this.areaBasedList(contentTypeId, numOfRows, pageNo);
    return items.map(toPlaceDto);
  }

  /** 위치기반 관광지 조회 (뚜벅이 동선 — 좌표 반경 내 스팟) */
  async findByLocation(query: LocationSpotQueryDto): Promise<PlaceDto[]> {
    const { items } = await this.tourApi.getList<TourRawItem>(
      KOR_SERVICE,
      'locationBasedList2',
      {
        mapX: query.mapX,
        mapY: query.mapY,
        radius: query.radius,
        contentTypeId: query.contentTypeId,
        numOfRows: query.numOfRows,
        arrange: 'E', // 거리순(이미지 있는 항목 우선)
      },
    );
    return items.map(toPlaceDto);
  }

  /** 관광지 상세 (공통정보) */
  async findDetail(contentId: string): Promise<PlaceDto & { overview?: string }> {
    const { items } = await this.tourApi.getList<TourRawItem & { overview?: string }>(
      KOR_SERVICE,
      'detailCommon2',
      {
        contentId,
        defaultYN: 'Y',
        firstImageYN: 'Y',
        addrinfoYN: 'Y',
        mapinfoYN: 'Y',
        overviewYN: 'Y',
      },
    );
    const raw = items[0];
    if (!raw) {
      return { contentId, contentTypeId: '', title: '' } as PlaceDto;
    }
    return { ...toPlaceDto(raw), overview: raw.overview };
  }

  /** 관광지 이미지 목록 (감성 인증 카드용 원본) */
  async findImages(contentId: string): Promise<string[]> {
    const { items } = await this.tourApi.getList<{ originimgurl?: string }>(
      KOR_SERVICE,
      'detailImage2',
      { contentId, imageYN: 'Y' },
    );
    return items.map((i) => i.originimgurl).filter((u): u is string => !!u);
  }

  /** 강원 시군구 코드 조회 (감성존 상수 검증용 디버그) */
  async findAreaCodes(): Promise<{ code: string; name: string }[]> {
    const { items } = await this.tourApi.getList<{ code: string; name: string }>(
      KOR_SERVICE,
      'areaCode2',
      { areaCode: GANGWON_AREA_CODE, numOfRows: 50 },
    );
    return items.map((i) => ({ code: i.code, name: i.name }));
  }

  private async areaBasedList(
    contentTypeId: ContentType | undefined,
    numOfRows: number | undefined,
    pageNo: number | undefined,
    sigunguCode?: string,
  ): Promise<TourRawItem[]> {
    const { items } = await this.tourApi.getList<TourRawItem>(
      KOR_SERVICE,
      'areaBasedList2',
      {
        areaCode: GANGWON_AREA_CODE,
        sigunguCode,
        contentTypeId,
        numOfRows,
        pageNo,
        arrange: 'O', // 제목순(이미지 있는 항목 우선 'Q'/'R'도 가능)
      },
    );
    return items;
  }

  private dedupe(items: TourRawItem[]): TourRawItem[] {
    const seen = new Set<string>();
    return items.filter((it) => {
      if (seen.has(it.contentid)) return false;
      seen.add(it.contentid);
      return true;
    });
  }
}
