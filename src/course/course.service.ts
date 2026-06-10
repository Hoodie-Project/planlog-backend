import { Injectable, NotFoundException } from '@nestjs/common';
import { TourApiService } from '../tour-api/tour-api.service';
import { TourRawItem } from '../tour-api/tour-api.types';
import {
  ContentType,
  GANGWON_AREA_CODE,
  Style,
  Transport,
  Zone,
  ZONE_META,
  inferZone,
} from '../common/gangwon.constants';
import {
  LatLng,
  haversineMeters,
  toLatLng,
  travelMinutes,
} from '../common/geo';
import { CreateCourseDto } from './dto/create-course.dto';
import {
  CourseCongestionDto,
  CourseDayDto,
  CourseDto,
  CourseItemDto,
  CourseItemType,
  CourseRelatedDebugDto,
  RelatedLegDto,
} from './dto/course.dto';
import { CongestionService } from '../congestion/congestion.service';
import {
  RelatedService,
  normalizeSpotName,
} from '../related/related.service';
import { PetService } from '../pet/pet.service';

const KOR_SERVICE = 'KorService2';

/** 내부 작업용: 좌표가 확보된 후보 장소 */
interface Candidate {
  raw: TourRawItem;
  pos: LatLng;
  score: number;
}

type Rng = () => number;

const SPOT_STAY_MIN = 90; // 관광지 체류
const MEAL_STAY_MIN = 60; // 점심 체류
const DAY_START = 10 * 60; // 10:00 (분)
const LUNCH_AFTER = 13 * 60; // 13:00 넘으면 점심 삽입

@Injectable()
export class CourseService {
  constructor(
    private readonly tourApi: TourApiService,
    private readonly congestion: CongestionService,
    private readonly related: RelatedService,
    private readonly pet: PetService,
  ) {}

  /**
   * 무드 셀렉터 입력 → 1~3일 완성형 코스 자동 생성.
   * 후보를 점수화하되 출발 클러스터·동선 선택에 가중 랜덤을 적용해
   * 같은 입력이라도 매번 다른 코스가 나오도록 한다(seed 주면 재현).
   */
  async generate(dto: CreateCourseDto): Promise<CourseDto> {
    const zone = dto.zone;
    const transport = dto.transport ?? Transport.WALK;
    const style = dto.style ?? Style.SOLO;
    const spotCount = dto.spotCount ?? 3;
    const nights = dto.nights ?? 0;
    const dayCount = nights + 1;
    const rng = this.makeRng(dto.seed);
    const maxLeg = this.maxLegMeters(transport);

    const [defaultSpots, restaurantPool, stayPool] = await Promise.all([
      this.collect(zone, ContentType.TOURIST_SPOT),
      this.collect(zone, ContentType.RESTAURANT),
      this.collectStays(zone, style),
    ]);

    // 반려동물 스타일이면 동반 가능 관광지를 우선 풀로 사용(부족하면 일반으로 폴백)
    let spotPool = defaultSpots;
    if (style === Style.PET) {
      const petRaw = await this.pet.getPetSpotRawItems(zone);
      const petCands = this.toCandidates(petRaw, ZONE_META[zone].keywords);
      if (petCands.length >= 3) spotPool = petCands;
    }
    if (spotPool.length === 0) {
      throw new NotFoundException(
        '해당 감성존에서 좌표가 있는 관광지를 찾지 못했습니다.',
      );
    }

    // 연관관광지 맵 + 풀 이름 인덱스 (실패해도 코스 생성은 계속)
    const relatedMap = await this.safeRelatedMap(zone);
    const nameIndex = new Map<string, Candidate>();
    for (const c of spotPool) {
      nameIndex.set(normalizeSpotName(c.raw.title), c);
    }
    // 연관 데이터의 기준 관광지(잘 연결된 인기 스팟)에 점수 가산 → 동선이 그쪽으로 쏠려 매칭률↑
    if (relatedMap.size > 0) {
      for (const c of spotPool) {
        if (relatedMap.has(normalizeSpotName(c.raw.title))) c.score += 10;
      }
    }
    const legs: RelatedLegDto[] = [];

    const explicitStart = toLatLng(dto.startMapX, dto.startMapY);
    const used = new Set<string>();
    const days: CourseDayDto[] = [];

    for (let d = 0; d < dayCount; d++) {
      const isLast = d === dayCount - 1;
      const available = spotPool.filter((c) => !used.has(c.raw.contentid));
      if (available.length === 0) break;

      // 1일차는 출발좌표 우선, 이후엔 매일 새 밀집 클러스터에서 시작(지역 탐색 + 다양성)
      const anchor =
        d === 0 && explicitStart
          ? explicitStart
          : this.pickAnchorRandom(available, maxLeg, rng);

      const daySpots =
        relatedMap.size > 0
          ? this.routeRelatedAware(
              available,
              anchor,
              spotCount,
              maxLeg,
              rng,
              relatedMap,
              nameIndex,
              legs,
            )
          : this.routeNearestRandom(available, anchor, spotCount, maxLeg, rng);
      if (daySpots.length === 0) break;
      daySpots.forEach((s) => used.add(s.raw.contentid));

      const midPos = daySpots[Math.floor(daySpots.length / 2)]?.pos ?? anchor;
      const meal = this.pickNearRandom(restaurantPool, midPos, used, rng);
      if (meal) used.add(meal.raw.contentid);

      const lastPos = daySpots[daySpots.length - 1]?.pos ?? anchor;
      const stay = isLast
        ? null
        : this.pickNearRandom(stayPool, lastPos, used, rng);
      if (stay) used.add(stay.raw.contentid);

      const items = this.buildItinerary(daySpots, meal, stay, anchor, transport);
      const distance = items.reduce((s, it) => s + it.distanceFromPrev, 0);
      const travel = items.reduce((s, it) => s + it.travelMinutesFromPrev, 0);
      const spotN = items.filter((i) => i.type === CourseItemType.SPOT).length;

      days.push({
        day: d + 1,
        summary: `${d + 1}일차 · ${spotN}곳`,
        distance: Math.round(distance),
        travelMinutes: travel,
        items,
      });
    }

    const totalDistance = days.reduce((s, d) => s + d.distance, 0);
    const totalTravelMinutes = days.reduce((s, d) => s + d.travelMinutes, 0);

    const congestion = dto.travelDate
      ? await this.buildCongestion(dto.travelDate)
      : undefined;

    const relatedDebug = dto.debug
      ? this.buildRelatedDebug(relatedMap.size, legs)
      : undefined;

    return {
      zone,
      zoneLabel: ZONE_META[zone].label,
      transport,
      style,
      nights,
      summary: `${ZONE_META[zone].label} ${this.transportLabel(transport)} ${this.nightsLabel(nights)} 코스`,
      totalDistance,
      totalTravelMinutes,
      days,
      congestion,
      relatedDebug,
    };
  }

  /** 연관관광지 맵 조회(실패 시 빈 맵 — 코스 생성을 막지 않음) */
  private async safeRelatedMap(zone: Zone): Promise<Map<string, string[]>> {
    try {
      return await this.related.getRelatedMap(zone);
    } catch {
      return new Map();
    }
  }

  private buildRelatedDebug(
    relatedMapSize: number,
    legs: RelatedLegDto[],
  ): CourseRelatedDebugDto {
    const matchedLegs = legs.filter((l) => l.matchedRelated).length;
    const totalLegs = legs.length;
    return {
      used: relatedMapSize > 0,
      relatedMapSize,
      matchedLegs,
      totalLegs,
      hitRate: totalLegs ? Math.round((matchedLegs / totalLegs) * 100) : 0,
      legs,
    };
  }

  /** 여행 날짜 요일의 혼잡도 + 한산한 요일 추천 (혼잡 회피) */
  private async buildCongestion(
    travelDate: string,
  ): Promise<CourseCongestionDto | undefined> {
    try {
      const weekdays = await this.congestion.getGangwonWeekdayCongestion();
      if (weekdays.length === 0) return undefined;
      const code = this.weekdayCodeOf(travelDate);
      const today = weekdays.find((w) => w.weekdayCode === code);
      if (!today) return undefined;
      const leastBusy = this.congestion.pickLeastBusy(weekdays);
      const recommendedWeekday = leastBusy?.weekday ?? null;

      let message: string;
      if (today.level === 'HIGH') {
        message = `${today.weekday}은 강원 관광객이 가장 몰리는 편이에요.${recommendedWeekday && recommendedWeekday !== today.weekday ? ` ${recommendedWeekday}이 더 한산해요.` : ''}`;
      } else if (today.level === 'MEDIUM') {
        message = `${today.weekday}은 적당한 혼잡도예요.`;
      } else {
        message = `${today.weekday}은 비교적 한산해 여유로운 여행이 가능해요.`;
      }

      return {
        date: travelDate,
        weekday: today.weekday,
        index: today.index,
        level: today.level,
        recommendedWeekday,
        message,
      };
    } catch {
      // 혼잡도 데이터가 없어도 코스 생성은 막지 않는다(graceful degradation)
      return undefined;
    }
  }

  private weekdayCodeOf(date: string): string {
    const ymd = date.replace(/-/g, '');
    const y = Number(ymd.slice(0, 4));
    const m = Number(ymd.slice(4, 6)) - 1;
    const d = Number(ymd.slice(6, 8));
    const js = new Date(y, m, d).getDay();
    return String(js === 0 ? 7 : js);
  }

  /** 감성존 시군구들에서 특정 타입 후보를 모아 좌표/점수 부여 */
  private async collect(
    zone: Zone,
    contentTypeId: ContentType,
  ): Promise<Candidate[]> {
    const meta = ZONE_META[zone];
    const results = await Promise.all(
      meta.sigunguCodes.map((code) =>
        this.tourApi.getList<TourRawItem>(KOR_SERVICE, 'areaBasedList2', {
          areaCode: GANGWON_AREA_CODE,
          sigunguCode: code,
          contentTypeId,
          numOfRows: 100,
          arrange: 'O',
        }),
      ),
    );
    return this.toCandidates(results.flatMap((r) => r.items), meta.keywords);
  }

  private async collectStays(zone: Zone, style: Style): Promise<Candidate[]> {
    const meta = ZONE_META[zone];
    const results = await Promise.all(
      meta.sigunguCodes.map((code) =>
        this.tourApi.getList<TourRawItem>(KOR_SERVICE, 'searchStay2', {
          areaCode: GANGWON_AREA_CODE,
          sigunguCode: code,
          numOfRows: 20,
          arrange: 'O',
        }),
      ),
    );
    let items = results.flatMap((r) => r.items);
    // 반려동물 스타일이면 캠핑/펜션 위주로 살짝 가중(상세 펫 API 연동은 다음 반복)
    if (style === Style.PET) {
      const petFiltered = items.filter((it) =>
        /펜션|캠핑|글램핑|풀빌라/.test(it.title),
      );
      if (petFiltered.length > 0) items = petFiltered;
    }
    return this.toCandidates(items, meta.keywords);
  }

  /** 좌표 있는 항목만 후보화 + 감성 키워드/이미지 점수 부여 */
  private toCandidates(items: TourRawItem[], keywords: string[]): Candidate[] {
    const seen = new Set<string>();
    const out: Candidate[] = [];
    for (const raw of items) {
      if (seen.has(raw.contentid)) continue;
      const pos = toLatLng(raw.mapx, raw.mapy);
      if (!pos) continue;
      seen.add(raw.contentid);
      let score = 0;
      if (keywords.some((kw) => raw.title?.includes(kw))) score += 2;
      if (raw.firstimage) score += 1; // 이미지 있는 곳 우선(감성 콘텐츠)
      out.push({ raw, pos, score });
    }
    return out;
  }

  /** 이동수단별 한 구간 최대 이동 거리(m) */
  private maxLegMeters(transport: Transport): number {
    switch (transport) {
      case Transport.WALK:
        return 2500; // 도보 ~35분
      case Transport.KTX:
        return 6000; // 역+도보/대중교통
      case Transport.CAR:
        return 30000; // 렌터카
      default:
        return 2500;
    }
  }

  /** seed 있으면 결정적(mulberry32), 없으면 매번 다른 난수 생성기 */
  private makeRng(seed?: number): Rng {
    if (seed === undefined) return () => Math.random();
    let a = seed >>> 0;
    return () => {
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /** 밀집도+감성점수 상위 후보 중 가중 랜덤으로 출발 클러스터 선택 */
  private pickAnchorRandom(
    candidates: Candidate[],
    maxLeg: number,
    rng: Rng,
  ): LatLng {
    const scored = candidates
      .map((c) => {
        let neighbors = 0;
        for (const o of candidates) {
          if (haversineMeters(c.pos, o.pos) <= maxLeg) neighbors++;
        }
        return { item: c, weight: neighbors + c.score };
      })
      .sort((a, b) => b.weight - a.weight);
    const topK = scored.slice(0, Math.min(6, scored.length));
    return this.weightedPick(topK, rng).item.pos;
  }

  /**
   * 출발점에서 최근접 이웃으로 n개 선택(한 구간 maxLeg 이내).
   * 매 단계 가까운 상위 3곳 중 가중 랜덤 → 동선에 변주를 준다.
   */
  private routeNearestRandom(
    candidates: Candidate[],
    start: LatLng,
    n: number,
    maxLeg: number,
    rng: Rng,
  ): Candidate[] {
    const pool = [...candidates];
    const route: Candidate[] = [];
    let cursor = start;
    while (route.length < n && pool.length > 0) {
      const inRange = pool
        .map((c, i) => ({
          item: c,
          poolIdx: i,
          adj: haversineMeters(cursor, c.pos) - c.score * 300,
        }))
        .filter((x) => haversineMeters(cursor, x.item.pos) <= maxLeg)
        .sort((a, b) => a.adj - b.adj);
      if (inRange.length === 0) break;
      const top = inRange.slice(0, Math.min(3, inRange.length));
      // 가까울수록(앞 순위) 큰 가중치
      const weighted = top.map((x, idx) => ({ ...x, weight: top.length - idx }));
      const pick = this.weightedPick(weighted, rng);
      route.push(pick.item);
      pool.splice(pick.poolIdx, 1);
      cursor = pick.item.pos;
    }
    return route;
  }

  /**
   * 연관관광지 우선 동선: 직전 관광지의 연관 관광지가 풀에 있으면 그쪽으로 잇고,
   * 없으면 최근접으로 폴백. 구간별 매칭 결과를 legs 에 기록(적중률 진단용).
   */
  private routeRelatedAware(
    candidates: Candidate[],
    start: LatLng,
    n: number,
    maxLeg: number,
    rng: Rng,
    relatedMap: Map<string, string[]>,
    nameIndex: Map<string, Candidate>,
    legs: RelatedLegDto[],
  ): Candidate[] {
    const pool = [...candidates];
    const route: Candidate[] = [];
    const usedIds = new Set<string>();
    let cursor = start;
    let prevName: string | null = null;

    const removeFromPool = (c: Candidate) => {
      const i = pool.findIndex((p) => p.raw.contentid === c.raw.contentid);
      if (i >= 0) pool.splice(i, 1);
    };

    while (route.length < n && pool.length > 0) {
      let pick: Candidate | null = null;

      // 1) 직전 관광지의 연관 관광지를 풀에서 찾아 우선 연결
      if (prevName) {
        const relNames = relatedMap.get(normalizeSpotName(prevName)) ?? [];
        const matched: { item: Candidate; weight: number }[] = [];
        const availableNames: string[] = [];
        relNames.forEach((rn, idx) => {
          const c = this.matchInPool(nameIndex, rn);
          if (
            c &&
            !usedIds.has(c.raw.contentid) &&
            haversineMeters(cursor, c.pos) <= maxLeg
          ) {
            availableNames.push(c.raw.title);
            if (matched.length < 3) {
              matched.push({ item: c, weight: relNames.length - idx });
            }
          }
        });
        if (matched.length > 0) {
          pick = this.weightedPick(matched, rng).item;
        }
        legs.push({
          fromSpot: prevName,
          matchedRelated: pick ? pick.raw.title : null,
          available: availableNames,
        });
      }

      // 2) 폴백: 최근접(상위 3 가중 랜덤)
      if (!pick) {
        const inRange = pool
          .filter((c) => haversineMeters(cursor, c.pos) <= maxLeg)
          .sort(
            (a, b) =>
              haversineMeters(cursor, a.pos) -
              a.score * 300 -
              (haversineMeters(cursor, b.pos) - b.score * 300),
          );
        if (inRange.length === 0) break;
        const top = inRange
          .slice(0, Math.min(3, inRange.length))
          .map((c, idx) => ({ item: c, weight: 3 - idx }));
        pick = this.weightedPick(top, rng).item;
      }

      route.push(pick);
      usedIds.add(pick.raw.contentid);
      removeFromPool(pick);
      cursor = pick.pos;
      prevName = pick.raw.title;
    }
    return route;
  }

  /** 연관 관광지명 → 풀의 관광지 매칭 (정규화 후 동일/부분일치) */
  private matchInPool(
    nameIndex: Map<string, Candidate>,
    relatedName: string,
  ): Candidate | null {
    const key = normalizeSpotName(relatedName);
    if (key.length < 2) return null;
    const exact = nameIndex.get(key);
    if (exact) return exact;
    for (const [name, cand] of nameIndex) {
      if (name.length >= 2 && (name.includes(key) || key.includes(name))) {
        return cand;
      }
    }
    return null;
  }

  /** 기준점 인근 미사용 후보 상위 5곳 중 가중 랜덤 1곳 (점심/숙소용) */
  private pickNearRandom(
    candidates: Candidate[],
    from: LatLng,
    used: Set<string>,
    rng: Rng,
  ): Candidate | null {
    const avail = candidates
      .filter((c) => !used.has(c.raw.contentid))
      .map((c) => ({ item: c, d: haversineMeters(from, c.pos) }))
      .sort((a, b) => a.d - b.d);
    if (avail.length === 0) return null;
    const top = avail
      .slice(0, Math.min(5, avail.length))
      .map((x, idx) => ({ item: x.item, weight: 5 - idx }));
    return this.weightedPick(top, rng).item;
  }

  /** weight 비례 랜덤 선택 */
  private weightedPick<T extends { weight: number }>(arr: T[], rng: Rng): T {
    const total = arr.reduce((s, x) => s + Math.max(x.weight, 0.0001), 0);
    let r = rng() * total;
    for (const x of arr) {
      r -= Math.max(x.weight, 0.0001);
      if (r <= 0) return x;
    }
    return arr[arr.length - 1];
  }

  /** 하루 동선 + 점심 + 숙소를 시간표로 배치 */
  private buildItinerary(
    spots: Candidate[],
    meal: Candidate | null,
    stay: Candidate | null,
    start: LatLng,
    transport: Transport,
  ): CourseItemDto[] {
    const items: CourseItemDto[] = [];
    let clock = DAY_START;
    let prevPos = start;
    let mealInserted = false;

    const push = (c: Candidate, type: CourseItemType, stayMin: number): void => {
      const dist = haversineMeters(prevPos, c.pos);
      const travel = travelMinutes(dist, transport);
      clock += travel;
      items.push({
        order: items.length + 1,
        type,
        contentId: c.raw.contentid,
        title: c.raw.title,
        zone: inferZone(c.raw.title, c.raw.sigungucode),
        address:
          [c.raw.addr1, c.raw.addr2].filter(Boolean).join(' ') || undefined,
        image: c.raw.firstimage || c.raw.firstimage2 || undefined,
        mapX: c.raw.mapx,
        mapY: c.raw.mapy,
        arriveTime: this.fmt(clock),
        stayMinutes: stayMin,
        travelMinutesFromPrev: travel,
        distanceFromPrev: Math.round(dist),
      });
      clock += stayMin;
      prevPos = c.pos;
    };

    for (const spot of spots) {
      if (!mealInserted && meal && clock >= LUNCH_AFTER) {
        push(meal, CourseItemType.MEAL, MEAL_STAY_MIN);
        mealInserted = true;
      }
      push(spot, CourseItemType.SPOT, SPOT_STAY_MIN);
    }
    if (!mealInserted && meal) {
      push(meal, CourseItemType.MEAL, MEAL_STAY_MIN);
    }
    if (stay) {
      push(stay, CourseItemType.STAY, 0);
    }
    return items;
  }

  private fmt(minutes: number): string {
    const h = Math.floor(minutes / 60) % 24;
    const m = minutes % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  }

  private transportLabel(t: Transport): string {
    return { WALK: '뚜벅이', KTX: 'KTX', CAR: '렌터카' }[t] ?? '';
  }

  private nightsLabel(nights: number): string {
    if (nights <= 0) return '당일치기';
    return `${nights}박${nights + 1}일`;
  }
}
