import { Injectable } from '@nestjs/common';
import { TourApiService } from '../tour-api/tour-api.service';
import { TourRawItem } from '../tour-api/tour-api.types';
import {
  ContentType,
  GANGWON_AREA_CODE,
  ZONE_META,
} from '../common/gangwon.constants';
import { PlaceDto, toPlaceDto } from '../common/dto/place.dto';
import { LocationSpotQueryDto, ZoneSpotQueryDto } from './dto/spot-query.dto';
import { SpotIntroDto } from './dto/spot-intro.dto';
import { PrismaService } from '../prisma/prisma.service';

const KOR_SERVICE = 'KorService2';

/** detailIntro2 raw 응답(관광 계열) — 필드는 존재할 때만 값이 들어옴 */
interface SpotIntroRawItem {
  infocenter?: string;
  opendate?: string;
  restdate?: string;
  usetime?: string;
  useseason?: string;
  parking?: string;
  chkbabycarriage?: string;
  chkpet?: string;
  chkcreditcard?: string;
}

@Injectable()
export class SpotService {
  constructor(
    private readonly tourApi: TourApiService,
    private readonly prisma: PrismaService,
  ) {}

  /** 감성존(또는 강원 전체) 지역기반 관광지 조회 */
  async findByZone(query: ZoneSpotQueryDto): Promise<PlaceDto[]> {
    const { zone, contentTypeId, numOfRows, pageNo, excludeContentIds } = query;

    // 감성존이 지정되면 해당 시군구들을 병렬 조회 후 병합, 아니면 강원 전체 1회 조회.
    if (zone) {
      const codes = ZONE_META[zone].sigunguCodes;
      const results = await Promise.all(
        codes.map((code) =>
          this.areaBasedList(contentTypeId, numOfRows, pageNo, code),
        ),
      );
      const places = this.dedupe(results.flat()).map((it) => ({
        ...toPlaceDto(it),
        zone, // 존 조회 결과는 해당 존으로 확정 태깅
      }));
      return this.excludeIds(places, excludeContentIds);
    }

    const items = await this.areaBasedList(contentTypeId, numOfRows, pageNo);
    return this.excludeIds(items.map(toPlaceDto), excludeContentIds);
  }

  /** 위치기반 관광지 조회 (뚜벅이 동선 — 좌표 반경 내 스팟, 코스 장소 교체용) */
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
    return this.excludeIds(items.map(toPlaceDto), query.excludeContentIds);
  }

  /**
   * 관광지 상세 (공통정보 + 이용정보).
   * userId 를 주면(로그인 시) 이 장소를 이미 방문(스탬프)했는지도 함께 반환.
   */
  async findDetail(
    contentId: string,
    userId?: string,
  ): Promise<
    PlaceDto & {
      overview?: string;
      intro?: SpotIntroDto;
      stamped?: boolean;
      visitedAt?: Date | null;
    }
  > {
    // ⚠️ defaultYN/firstImageYN/addrinfoYN/mapinfoYN/overviewYN 파라미터는
    // TourAPI 쪽에서 INVALID_REQUEST_PARAMETER_ERROR 로 거부함(스펙 변경) — 주지 않으면
    // overview 포함 전체 필드가 기본으로 내려온다.
    const { items } = await this.tourApi.getList<
      TourRawItem & { overview?: string }
    >(KOR_SERVICE, 'detailCommon2', { contentId });
    const raw = items[0];
    if (!raw) {
      return { contentId, contentTypeId: '', title: '' };
    }

    const [intro, stamp] = await Promise.all([
      this.fetchIntro(contentId, raw.contenttypeid),
      userId
        ? this.prisma.stamp.findUnique({
            where: { userId_contentId: { userId, contentId } },
          })
        : Promise.resolve(null),
    ]);

    return {
      ...toPlaceDto(raw),
      overview: raw.overview,
      intro,
      ...(userId
        ? { stamped: !!stamp, visitedAt: stamp?.visitedAt ?? null }
        : {}),
    };
  }

  /** 관광지 상세 이용정보(detailIntro2) — 없거나 실패해도 기본 상세는 보여줘야 하므로 undefined 반환 */
  private async fetchIntro(
    contentId: string,
    contentTypeId: string,
  ): Promise<SpotIntroDto | undefined> {
    try {
      const { items } = await this.tourApi.getList<SpotIntroRawItem>(
        KOR_SERVICE,
        'detailIntro2',
        { contentId, contentTypeId },
      );
      const raw = items[0];
      if (!raw) return undefined;
      return {
        infoCenter: raw.infocenter || undefined,
        openDate: raw.opendate || undefined,
        restDate: raw.restdate || undefined,
        useTime: raw.usetime || undefined,
        useSeason: raw.useseason || undefined,
        parking: raw.parking || undefined,
        babyCarriage: raw.chkbabycarriage || undefined,
        petAllowed: raw.chkpet || undefined,
        creditCard: raw.chkcreditcard || undefined,
      };
    } catch {
      return undefined;
    }
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
    const { items } = await this.tourApi.getList<{
      code: string;
      name: string;
    }>(KOR_SERVICE, 'areaCode2', {
      areaCode: GANGWON_AREA_CODE,
      numOfRows: 50,
    });
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

  /** excludeContentIds(쉼표 구분 문자열)에 해당하는 항목 제외 */
  private excludeIds(
    places: PlaceDto[],
    excludeContentIds?: string,
  ): PlaceDto[] {
    if (!excludeContentIds) return places;
    const excluded = new Set(
      excludeContentIds
        .split(',')
        .map((id) => id.trim())
        .filter(Boolean),
    );
    return places.filter((p) => !excluded.has(p.contentId));
  }
}
