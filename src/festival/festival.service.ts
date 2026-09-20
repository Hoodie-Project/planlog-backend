import { Injectable } from '@nestjs/common';
import { TourApiService } from '../tour-api/tour-api.service';
import { TourRawItem } from '../tour-api/tour-api.types';
import {
  GANGWON_AREA_CODE,
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

    // eventStartDate: TourAPI 필수 파라미터. 강원 축제 등록 건수 자체가 적어
    // 넉넉히(1년) 과거까지 열어야 데이터가 비지 않는다(등록 데이터 희소성 확인됨).
    const { items } = await this.tourApi.getList<TourRawItem>(
      KOR_SERVICE,
      'searchFestival2',
      {
        areaCode: GANGWON_AREA_CODE,
        eventStartDate: this.toYmd(this.daysAgo(365)),
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
      const weekendFestivals = festivals.filter((f) => f.isThisWeekend);
      if (weekendFestivals.length > 0) return weekendFestivals;

      // 이번 주말 겹치는 축제가 없으면(등록 데이터 희소) 이번 달~+2개월(연도 무관, 월만 비교)
      // 시즌에 해당하는 축제로 대체 노출
      const seasonFestivals = festivals.filter((f) =>
        this.inSeasonWindow(f.eventStartDate, f.eventEndDate),
      );
      if (seasonFestivals.length > 0)
        return this.sortByRecency(seasonFestivals);

      // 그마저도 없으면 강원 축제 전체를 최신순으로 노출(빈 화면 방지 최종 안전망)
      return this.sortByRecency(festivals);
    }

    // 주말 개최 축제를 상단으로, 그 안에서는 최신순으로 정렬
    return festivals.sort((a, b) => {
      const weekendDiff = Number(b.isThisWeekend) - Number(a.isThisWeekend);
      return weekendDiff !== 0 ? weekendDiff : this.compareRecency(a, b);
    });
  }

  /** 시작일 기준 최신순(가까운 과거/미래 우선) 정렬 */
  private sortByRecency(festivals: FestivalDto[]): FestivalDto[] {
    return [...festivals].sort((a, b) => this.compareRecency(a, b));
  }

  private compareRecency(a: FestivalDto, b: FestivalDto): number {
    const da = this.parseYmd(a.eventStartDate ?? '');
    const db = this.parseYmd(b.eventStartDate ?? '');
    if (!da || !db) return 0;
    return db.getTime() - da.getTime(); // 시작일이 늦은(최신) 순
  }

  /** 이번 달부터 +2개월(연도 무관, 월만 비교)에 해당하는 시즌 축제인지 */
  private inSeasonWindow(start?: string, end?: string): boolean {
    if (!start) return false;
    const s = this.parseYmd(start);
    const e = end ? this.parseYmd(end) : s;
    if (!s || !e) return false;

    const targetMonths = this.seasonMonths();
    const cursor = new Date(s.getFullYear(), s.getMonth(), 1);
    const endCursor = new Date(e.getFullYear(), e.getMonth(), 1);
    for (let i = 0; cursor <= endCursor && i < 24; i++) {
      if (targetMonths.has(cursor.getMonth() + 1)) return true;
      cursor.setMonth(cursor.getMonth() + 1);
    }
    return false;
  }

  /** 이번 달, 다음 달, 다다음 달 (1~12, 연도 무관) */
  private seasonMonths(): Set<number> {
    const thisMonth = new Date().getMonth() + 1;
    return new Set(
      [0, 1, 2].map((offset) => ((thisMonth - 1 + offset) % 12) + 1),
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
