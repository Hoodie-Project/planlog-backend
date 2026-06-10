import { Injectable } from '@nestjs/common';
import { TourApiService } from '../tour-api/tour-api.service';
import { TourRawItem } from '../tour-api/tour-api.types';
import {
  GANGWON_AREA_CODE,
  Zone,
  ZONE_META,
  inferZone,
} from '../common/gangwon.constants';
import { toPlaceDto } from '../common/dto/place.dto';
import { FestivalQueryDto } from './dto/festival-query.dto';
import { FestivalDto } from './dto/festival.dto';

const KOR_SERVICE = 'KorService2';

@Injectable()
export class FestivalService {
  constructor(private readonly tourApi: TourApiService) {}

  /** 주말 HOT 축제 — searchFestival2 + 이번 주 금토일 오버랩 필터 */
  async findFestivals(query: FestivalQueryDto): Promise<FestivalDto[]> {
    const weekendOnly = query.weekendOnly !== 'false'; // 기본 true
    const { friday, sunday } = this.thisWeekendRange();

    // eventStartDate: 오늘 이후 시작/진행중 축제를 충분히 받기 위해 이번 주 금요일 이전부터 조회
    const { items } = await this.tourApi.getList<TourRawItem>(
      KOR_SERVICE,
      'searchFestival2',
      {
        areaCode: GANGWON_AREA_CODE,
        eventStartDate: this.toYmd(this.daysAgo(60)),
        numOfRows: query.numOfRows,
        arrange: 'A',
      },
    );

    let festivals: FestivalDto[] = items.map((raw) => {
      const overlaps = this.overlapsWeekend(
        raw.eventstartdate,
        raw.eventenddate,
        friday,
        sunday,
      );
      return {
        ...toPlaceDto(raw),
        zone: inferZone(raw.title, raw.sigungucode),
        eventStartDate: raw.eventstartdate,
        eventEndDate: raw.eventenddate,
        isThisWeekend: overlaps,
      };
    });

    if (query.zone) {
      const codes = ZONE_META[query.zone].sigunguCodes;
      festivals = festivals.filter(
        (f) =>
          f.zone === query.zone ||
          (f.sigunguCode && codes.includes(f.sigunguCode)),
      );
    }

    if (weekendOnly) {
      festivals = festivals.filter((f) => f.isThisWeekend);
    }

    // 주말 개최 축제를 상단으로 정렬
    return festivals.sort(
      (a, b) => Number(b.isThisWeekend) - Number(a.isThisWeekend),
    );
  }

  /** 이번 주(오늘 기준) 금요일~일요일 날짜 범위 */
  private thisWeekendRange(): { friday: Date; sunday: Date } {
    const now = new Date();
    const day = now.getDay(); // 0=일 ... 5=금 6=토
    const friday = new Date(now);
    // 이번 주 금요일까지의 차이 (일요일이면 직전 금요일로 본다)
    const diffToFri = day === 0 ? -2 : 5 - day;
    friday.setDate(now.getDate() + diffToFri);
    friday.setHours(0, 0, 0, 0);
    const sunday = new Date(friday);
    sunday.setDate(friday.getDate() + 2);
    sunday.setHours(23, 59, 59, 999);
    return { friday, sunday };
  }

  private overlapsWeekend(
    start?: string,
    end?: string,
    friday?: Date,
    sunday?: Date,
  ): boolean {
    if (!start || !friday || !sunday) return false;
    const s = this.parseYmd(start);
    const e = end ? this.parseYmd(end) : s;
    if (!s || !e) return false;
    // [s, e] 와 [friday, sunday] 가 겹치는가
    return s <= sunday && e >= friday;
  }

  private parseYmd(ymd: string): Date | null {
    if (!/^\d{8}$/.test(ymd)) return null;
    const y = Number(ymd.slice(0, 4));
    const m = Number(ymd.slice(4, 6)) - 1;
    const d = Number(ymd.slice(6, 8));
    return new Date(y, m, d);
  }

  private toYmd(date: Date): string {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}${m}${d}`;
  }

  private daysAgo(n: number): Date {
    const d = new Date();
    d.setDate(d.getDate() - n);
    return d;
  }
}
