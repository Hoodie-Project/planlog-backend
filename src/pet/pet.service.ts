import { Injectable, Logger } from '@nestjs/common';
import { TourApiService } from '../tour-api/tour-api.service';
import { TourRawItem } from '../tour-api/tour-api.types';
import {
  ContentType,
  GANGWON_AREA_CODE,
  Zone,
  ZONE_META,
} from '../common/gangwon.constants';
import { PlaceDto, toPlaceDto } from '../common/dto/place.dto';
import { PetQueryDto } from './dto/pet-query.dto';

const PET_SERVICE = 'KorPetTourService2';
const KOR_SERVICE = 'KorService2';

@Injectable()
export class PetService {
  private readonly logger = new Logger(PetService.name);

  constructor(private readonly tourApi: TourApiService) {}

  /** 강원 반려동물 동반 가능 장소 목록 (관광지·음식점·숙박 등) */
  async findPetSpots(query: PetQueryDto): Promise<PlaceDto[]> {
    const raw = await this.fetchPetAreaList(
      query.zone,
      query.contentTypeId,
      query.numOfRows,
      query.pageNo,
    );
    return raw.map(toPlaceDto);
  }

  /** 코스 생성용 — 반려동물 동반 가능 관광지 원본(좌표 포함). 실패 시 빈 배열 */
  async getPetSpotRawItems(zone: Zone): Promise<TourRawItem[]> {
    try {
      return await this.fetchPetAreaList(
        zone,
        ContentType.TOURIST_SPOT,
        100,
        1,
      );
    } catch (e) {
      this.logger.warn(
        `반려동물 장소 조회 실패(폴백): ${(e as Error).message}`,
      );
      return [];
    }
  }

  /** 특정 관광지의 반려동물 동반 조건 상세 (KorService2 detailPetTour2) */
  async getPetInfo(contentId: string): Promise<Record<string, unknown> | null> {
    const { items } = await this.tourApi.getList<Record<string, unknown>>(
      KOR_SERVICE,
      'detailPetTour2',
      { contentId },
    );
    return items[0] ?? null;
  }

  private async fetchPetAreaList(
    zone: Zone | undefined,
    contentTypeId: ContentType | undefined,
    numOfRows = 20,
    pageNo = 1,
  ): Promise<TourRawItem[]> {
    const codes: (string | undefined)[] = zone
      ? ZONE_META[zone].sigunguCodes
      : [undefined];
    const results = await Promise.all(
      codes.map((sigunguCode) =>
        this.tourApi.getList<TourRawItem>(PET_SERVICE, 'areaBasedList2', {
          areaCode: GANGWON_AREA_CODE,
          sigunguCode,
          contentTypeId,
          numOfRows,
          pageNo,
          arrange: 'O',
        }),
      ),
    );
    return this.dedupe(results.flatMap((r) => r.items));
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
