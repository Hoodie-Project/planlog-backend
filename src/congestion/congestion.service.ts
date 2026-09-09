import { Injectable } from '@nestjs/common';
import { TourApiService } from '../tour-api/tour-api.service';

const DATALAB_SERVICE = 'DataLabService';
/** 한국관광 데이터랩 광역지자체 코드 — 강원특별자치도 */
const GANGWON_DL_CODE = '51';

/** metcoRegnVisitrDDList 응답 행 */
interface VisitorRow {
  areaCode: string;
  areaNm: string;
  daywkDivCd: string; // 1=월 ... 6=토, 7=일
  daywkDivNm: string;
  touDivCd: string; // 1=현지인, 2=외지인, 3=외국인
  touDivNm: string;
  touNum: string;
  baseYmd: string;
}

export type CongestionLevel = 'LOW' | 'MEDIUM' | 'HIGH';

export interface WeekdayCongestion {
  weekdayCode: string;
  weekday: string;
  /** 0~100 정규화 혼잡 지수 */
  index: number;
  level: CongestionLevel;
  avgVisitors: number;
}

@Injectable()
export class CongestionService {
  constructor(private readonly tourApi: TourApiService) {}

  /**
   * 강원 요일별 혼잡도(외지인+외국인 관광객 방문자 평균 기반).
   * DataLabService 방문자 추이 데이터를 요일별로 집계해 0~100 정규화.
   */
  async getGangwonWeekdayCongestion(): Promise<WeekdayCongestion[]> {
    const rows = await this.fetchGangwonVisitors();
    const byWeekday = new Map<
      string,
      { name: string; sum: number; cnt: number }
    >();
    for (const r of rows) {
      if (r.touDivCd === '1') continue; // 현지인 제외 → 관광객만
      const e = byWeekday.get(r.daywkDivCd) ?? {
        name: r.daywkDivNm,
        sum: 0,
        cnt: 0,
      };
      e.sum += Number(r.touNum) || 0;
      e.cnt += 1;
      byWeekday.set(r.daywkDivCd, e);
    }

    const avgs = [...byWeekday.entries()].map(([cd, e]) => ({
      cd,
      name: e.name,
      avg: e.cnt ? e.sum / e.cnt : 0,
    }));
    if (avgs.length === 0) return [];

    const values = avgs.map((a) => a.avg);
    const max = Math.max(...values);
    const min = Math.min(...values);
    const span = max - min || 1;

    return avgs
      .map((a) => {
        const index = Math.round(((a.avg - min) / span) * 100);
        return {
          weekdayCode: a.cd,
          weekday: a.name,
          index,
          level: this.toLevel(index),
          avgVisitors: Math.round(a.avg),
        };
      })
      .sort((x, y) => Number(x.weekdayCode) - Number(y.weekdayCode));
  }

  /** 특정 날짜(YYYY-MM-DD 또는 YYYYMMDD)의 혼잡도 */
  async getDateCongestion(date: string): Promise<WeekdayCongestion | null> {
    const weekdays = await this.getGangwonWeekdayCongestion();
    if (weekdays.length === 0) return null;
    const code = this.weekdayCode(date);
    return weekdays.find((w) => w.weekdayCode === code) ?? null;
  }

  /** 가장 한산한 요일(방문 추천) */
  pickLeastBusy(weekdays: WeekdayCongestion[]): WeekdayCongestion | null {
    if (weekdays.length === 0) return null;
    return weekdays.reduce((a, b) => (b.index < a.index ? b : a));
  }

  private async fetchGangwonVisitors(): Promise<VisitorRow[]> {
    // 미래/최근 데이터는 비어있어 약 40~68일 전 28일 구간을 표본으로 사용
    const endYmd = this.ymd(this.daysAgo(40));
    const startYmd = this.ymd(this.daysAgo(68));
    const { items } = await this.tourApi.getList<VisitorRow>(
      DATALAB_SERVICE,
      'metcoRegnVisitrDDList',
      { startYmd, endYmd, numOfRows: 3000, pageNo: 1 },
    );
    // 광역 단위는 지역 필터 파라미터가 없어 강원만 클라이언트에서 추출
    return items.filter((r) => r.areaCode === GANGWON_DL_CODE);
  }

  private toLevel(index: number): CongestionLevel {
    if (index >= 70) return 'HIGH';
    if (index >= 40) return 'MEDIUM';
    return 'LOW';
  }

  /** JS 요일(0=일) → 데이터랩 코드(1=월..7=일) */
  private weekdayCode(date: string): string {
    const ymd = date.replace(/-/g, '');
    const y = Number(ymd.slice(0, 4));
    const m = Number(ymd.slice(4, 6)) - 1;
    const d = Number(ymd.slice(6, 8));
    const js = new Date(y, m, d).getDay();
    return String(js === 0 ? 7 : js);
  }

  private daysAgo(n: number): Date {
    const d = new Date();
    d.setDate(d.getDate() - n);
    return d;
  }

  private ymd(date: Date): string {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}${m}${d}`;
  }
}
