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
import { LatLng, haversineMeters, toLatLng } from '../common/geo';
import {
  AccommodationQueryDto,
  LocationAccommodationQueryDto,
  StayType,
} from './dto/accommodation-query.dto';
import { StayDto } from './dto/stay.dto';
import { StayIntroDto } from './dto/stay-intro.dto';

const KOR_SERVICE = 'KorService2';
/** 시군구별 앵커(관광지 중심점) 계산용 표본 개수 */
const ANCHOR_SAMPLE_ROWS = 30;

/** searchStay2 응답의 숙박 분류 필드(있을 때 활용) */
interface StayRawItem extends TourRawItem {
  cat3?: string;
}

/** detailIntro2 raw 응답(숙박, contentTypeId=32) — 편의시설 플래그는 '1'=있음 */
interface StayIntroRawItem {
  checkintime?: string;
  checkouttime?: string;
  roomcount?: string;
  chkcooking?: string;
  parkinglodging?: string;
  infocenterlodging?: string;
  reservationurl?: string;
  subfacility?: string;
  barbecue?: string;
  beauty?: string;
  beverage?: string;
  bicycle?: string;
  campfire?: string;
  fitness?: string;
  karaoke?: string;
  publicbath?: string;
  publicpc?: string;
  sauna?: string;
  seminar?: string;
  sports?: string;
}

const AMENITY_LABELS: Record<string, string> = {
  barbecue: '바베큐',
  beauty: '뷰티시설',
  beverage: '식음료',
  bicycle: '자전거 대여',
  campfire: '캠프파이어',
  fitness: '헬스장',
  karaoke: '노래방',
  publicbath: '대중목욕탕',
  publicpc: '공용PC',
  sauna: '사우나',
  seminar: '세미나실',
  sports: '스포츠시설',
};

@Injectable()
export class AccommodationService {
  constructor(private readonly tourApi: TourApiService) {}

  async findStays(query: AccommodationQueryDto): Promise<StayDto[]> {
    const sigunguCodes: (string | undefined)[] = query.zone
      ? ZONE_META[query.zone].sigunguCodes
      : [undefined];

    const [results, anchors] = await Promise.all([
      Promise.all(
        sigunguCodes.map((code) =>
          this.searchStay(code, query.numOfRows, query.pageNo),
        ),
      ),
      query.zone
        ? this.computeSigunguAnchors(ZONE_META[query.zone].sigunguCodes)
        : Promise.resolve(new Map<string, LatLng>()),
    ]);

    let stays: StayDto[] = this.dedupe(results.flat()).map((raw) => ({
      ...toPlaceDto(raw),
      zone: query.zone ?? inferZone(raw.title, raw.sigungucode),
      stayType: this.classify(raw),
    }));

    if (anchors.size > 0) {
      stays = this.sortByZoneAnchor(stays, anchors);
    }

    if (query.type) {
      stays = stays.filter((s) => s.stayType === query.type);
    }
    return this.excludeIds(stays, query.excludeContentIds);
  }

  /**
   * 시군구별 "실제 관광지 분포 중심점"을 구해 숙소 정렬 기준으로 쓴다.
   * 존이 여러 시군구(예: 레트로존=강릉+원주)에 걸치면 시군구별로 따로 앵커를
   * 잡아야 한다 — 전체 평균을 내면 두 도시 사이 허허벌판이 나와버리기 때문.
   * (예: 강릉은 동해바다존과 시군구코드를 공유해서, 안 나누면 강릉 숙소가
   * 항상 해변 쪽 인기 숙소 위주로만 상위에 뜨는 문제가 있었음)
   */
  private async computeSigunguAnchors(
    sigunguCodes: string[],
  ): Promise<Map<string, LatLng>> {
    const anchors = new Map<string, LatLng>();
    await Promise.all(
      sigunguCodes.map(async (code) => {
        try {
          const { items } = await this.tourApi.getList<TourRawItem>(
            KOR_SERVICE,
            'areaBasedList2',
            {
              areaCode: GANGWON_AREA_CODE,
              sigunguCode: code,
              contentTypeId: ContentType.TOURIST_SPOT,
              numOfRows: ANCHOR_SAMPLE_ROWS,
              pageNo: 1,
            },
          );
          const points = items
            .map((it) => toLatLng(it.mapx, it.mapy))
            .filter((p): p is LatLng => p !== null);
          if (points.length === 0) return;
          anchors.set(code, {
            lat: points.reduce((s, p) => s + p.lat, 0) / points.length,
            lng: points.reduce((s, p) => s + p.lng, 0) / points.length,
          });
        } catch {
          // 앵커 계산 실패해도 숙소 조회 자체는 막지 않음(정렬 없이 원본 순서 유지)
        }
      }),
    );
    return anchors;
  }

  /** 숙소를 "속한 시군구의 관광지 중심점"과 가까운 순으로 정렬(좌표/앵커 없으면 뒤로) */
  private sortByZoneAnchor(
    stays: StayDto[],
    anchors: Map<string, LatLng>,
  ): StayDto[] {
    return stays
      .map((s, idx) => {
        const anchor = s.sigunguCode ? anchors.get(s.sigunguCode) : undefined;
        const pos = toLatLng(s.mapX, s.mapY);
        const dist =
          anchor && pos
            ? haversineMeters(pos, anchor)
            : Number.POSITIVE_INFINITY;
        return { s, dist, idx };
      })
      .sort((a, b) => a.dist - b.dist || a.idx - b.idx)
      .map((w) => w.s);
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

  /** 숙소 상세 (공통정보 + 숙박 특화 이용정보: 체크인/아웃, 객실 수, 부대시설 등) */
  async findDetail(
    contentId: string,
  ): Promise<StayDto & { overview?: string; intro?: StayIntroDto }> {
    // ⚠️ defaultYN/firstImageYN/addrinfoYN/mapinfoYN/overviewYN 파라미터는
    // TourAPI 쪽에서 INVALID_REQUEST_PARAMETER_ERROR 로 거부함(스펙 변경) — 주지 않으면
    // overview 포함 전체 필드가 기본으로 내려온다.
    const { items } = await this.tourApi.getList<
      StayRawItem & { overview?: string }
    >(KOR_SERVICE, 'detailCommon2', { contentId });
    const raw = items[0];
    if (!raw) {
      return {
        contentId,
        contentTypeId: '',
        title: '',
        stayType: StayType.VALUE,
        amenities: [],
      } as unknown as StayDto & { overview?: string; intro?: StayIntroDto };
    }

    const intro = await this.fetchIntro(contentId);

    return {
      ...toPlaceDto(raw),
      zone: inferZone(raw.title, raw.sigungucode),
      stayType: this.classify(raw),
      overview: raw.overview,
      intro,
    };
  }

  /** 숙박 상세 이용정보(detailIntro2) — 없거나 실패해도 기본 상세는 보여줘야 하므로 undefined 반환 */
  private async fetchIntro(
    contentId: string,
  ): Promise<StayIntroDto | undefined> {
    try {
      const { items } = await this.tourApi.getList<StayIntroRawItem>(
        KOR_SERVICE,
        'detailIntro2',
        { contentId, contentTypeId: ContentType.STAY },
      );
      const raw = items[0];
      if (!raw) return undefined;

      const amenities = Object.entries(AMENITY_LABELS)
        .filter(([key]) => raw[key as keyof StayIntroRawItem] === '1')
        .map(([, label]) => label);

      return {
        checkInTime: raw.checkintime || undefined,
        checkOutTime: raw.checkouttime || undefined,
        roomCount: raw.roomcount || undefined,
        cooking: raw.chkcooking || undefined,
        parking: raw.parkinglodging || undefined,
        infoCenter: raw.infocenterlodging || undefined,
        reservationUrl: raw.reservationurl || undefined,
        subFacility: raw.subfacility || undefined,
        amenities,
      };
    } catch {
      return undefined;
    }
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
