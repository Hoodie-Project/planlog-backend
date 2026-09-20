import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
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
import { RelatedService, normalizeSpotName } from '../related/related.service';
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
const FAMILY_SPOT_STAY_MIN = 120; // 가족과 함께: 체류시간을 넉넉하게
const MEAL_STAY_MIN = 60; // 점심/저녁 체류
const DAY_START = 10 * 60; // 기본 시작 시각 10:00 (분)
const LUNCH_AFTER = 13 * 60; // 13:00 넘으면 점심 삽입
const FAMILY_LEG_RATIO = 0.6; // 가족과 함께: 한 구간 최대 이동거리 축소 비율
/** 관광지 풀 다양성 — 관광지뿐 아니라 문화시설·레포츠도 섞어 매번 비슷한 장소만 나오지 않게 함 */
const SPOT_CONTENT_TYPES = [
  ContentType.TOURIST_SPOT,
  ContentType.CULTURE,
  ContentType.LEPORTS,
];
/** 조용히 쉬고 싶어요: 스팟 단위 혼잡도 데이터가 없어 "연관관광지 다발(=인기) 스팟"을
 *  혼잡 가능성이 높은 곳으로 보고 감점하는 근사치를 사용한다. */
const CALM_POPULARITY_PENALTY = -10;
const DEFAULT_POPULARITY_BONUS = 10;
/**
 * 출발지(역/터미널)에서 선택한 감성존까지 이동수단 기준 이동시간이 이보다 길면
 * 코스 생성을 거부한다. km 같은 고정 거리로 자르면 뚜벅이/렌터카처럼 속도 차가
 * 큰 이동수단에 똑같이 적용돼 말이 안 된다(예: 뚜벅이로 44km=11시간짜리 코스가
 * "거리는 50km 이내"라는 이유로 통과되는 문제가 있었다). 이동시간 기준이면
 * 뚜벅이는 짧은 거리, 렌터카는 먼 거리까지 자연스럽게 허용된다.
 */
const START_ZONE_MAX_MINUTES = 120;

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
    const maxLeg = this.maxLegMeters(transport, style);
    const dayStart = this.parseStartTime(dto.startTime) ?? DAY_START;
    const spotStayMin =
      style === Style.FAMILY ? FAMILY_SPOT_STAY_MIN : SPOT_STAY_MIN;
    const explicitStart = toLatLng(dto.startMapX, dto.startMapY);

    const [defaultSpots, restaurantPool, stayPool] = await Promise.all([
      this.collect(zone, SPOT_CONTENT_TYPES),
      this.collect(zone, [ContentType.RESTAURANT]),
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

    if (explicitStart) {
      const nearestMeters = Math.min(
        ...spotPool.map((c) => haversineMeters(explicitStart, c.pos)),
      );
      const nearestMinutes = travelMinutes(nearestMeters, transport);
      if (nearestMinutes > START_ZONE_MAX_MINUTES) {
        throw new BadRequestException(
          `선택하신 출발지가 '${ZONE_META[zone].label}'과 너무 멀리 떨어져 있어요` +
            `(${this.transportLabel(transport)} 기준 가장 가까운 관광지까지 약 ` +
            `${Math.round(nearestMinutes / 60)}시간, ${Math.round(nearestMeters / 1000)}km). ` +
            '더 가까운 감성존이나 출발지, 또는 이동수단을 선택해주세요.',
        );
      }
    }

    // 연관관광지 맵 + 풀 이름 인덱스 (실패해도 코스 생성은 계속)
    const relatedMap = await this.safeRelatedMap(zone);
    const nameIndex = new Map<string, Candidate>();
    for (const c of spotPool) {
      nameIndex.set(normalizeSpotName(c.raw.title), c);
    }
    // 연관 데이터의 기준 관광지(잘 연결된 인기 스팟)에 점수 가감
    // → 기본은 가산(동선이 그쪽으로 쏠려 매칭률↑), CALM(조용히 쉬고 싶어요)은
    //   인기 스팟일수록 혼잡할 가능성이 높다고 보고 감점(한적한 장소 우선)
    if (relatedMap.size > 0) {
      const popularityDelta =
        style === Style.CALM
          ? CALM_POPULARITY_PENALTY
          : DEFAULT_POPULARITY_BONUS;
      for (const c of spotPool) {
        if (relatedMap.has(normalizeSpotName(c.raw.title)))
          c.score += popularityDelta;
      }
    }
    const legs: RelatedLegDto[] = [];
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

      const items = this.buildItinerary(
        daySpots,
        restaurantPool,
        isLast ? null : stayPool,
        isLast,
        anchor,
        transport,
        dayStart,
        spotStayMin,
        used,
        rng,
        maxLeg,
      );
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

    const matchedLegs = legs.filter((l) => l.matchedRelated).length;
    const reasons = this.buildReasons({
      zoneLabel: ZONE_META[zone].label,
      transport,
      style,
      days,
      matchedLegs,
      congestion,
    });

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
      reasons,
    };
  }

  /** 실제로 이번 생성에 반영된 신호만 골라 추천 이유 문장으로 정리 */
  private buildReasons(params: {
    zoneLabel: string;
    transport: Transport;
    style: Style;
    days: CourseDayDto[];
    matchedLegs: number;
    congestion?: CourseCongestionDto;
  }): string[] {
    const { zoneLabel, transport, style, days, matchedLegs, congestion } =
      params;
    const reasons: string[] = [];
    const spotCount = days.reduce(
      (s, d) =>
        s + d.items.filter((i) => i.type === CourseItemType.SPOT).length,
      0,
    );

    reasons.push(
      `선택한 감성 '${zoneLabel}'과 일치하는 장소 ${spotCount}곳으로 구성했어요.`,
    );

    if (style === Style.PET) {
      reasons.push('반려동물 동반 가능한 장소를 우선 선정했어요.');
    }
    if (style === Style.FAMILY) {
      reasons.push(
        '이동 부담을 줄이기 위해 한 구간 거리를 좁히고, 머무는 시간은 넉넉하게 짰어요.',
      );
    }
    if (style === Style.CALM) {
      reasons.push('붐비는 인기 스팟보다 한적한 장소 위주로 구성했어요.');
    }

    reasons.push(
      `${this.transportLabel(transport)} 기준 한 구간 이동 범위 내에서 동선을 짰어요.`,
    );

    if (matchedLegs > 0) {
      reasons.push(
        `연관 관광지 데이터를 활용해 자연스럽게 이어지는 동선 ${matchedLegs}구간을 반영했어요.`,
      );
    }

    if (congestion) {
      if (
        congestion.level === 'HIGH' &&
        congestion.recommendedWeekday &&
        congestion.recommendedWeekday !== congestion.weekday
      ) {
        reasons.push(
          `${congestion.weekday}은 혼잡도가 높은 편이에요. ${congestion.recommendedWeekday}이 더 한산해요.`,
        );
      } else if (congestion.level !== 'HIGH') {
        reasons.push(
          `${congestion.weekday} 기준 혼잡 피크 시간대를 피해 여유롭게 다녀올 수 있어요.`,
        );
      }
    }

    return reasons;
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

  /** 감성존 시군구들에서 지정한 타입(들)의 후보를 모아 좌표/점수 부여 */
  private async collect(
    zone: Zone,
    contentTypeIds: ContentType[],
  ): Promise<Candidate[]> {
    const meta = ZONE_META[zone];
    const results = await Promise.all(
      meta.sigunguCodes.flatMap((code) =>
        contentTypeIds.map((contentTypeId) =>
          this.tourApi.getList<TourRawItem>(KOR_SERVICE, 'areaBasedList2', {
            areaCode: GANGWON_AREA_CODE,
            sigunguCode: code,
            contentTypeId,
            numOfRows: 100,
            arrange: 'O',
          }),
        ),
      ),
    );
    return this.toCandidates(
      results.flatMap((r) => r.items),
      meta.keywords,
    );
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

  /**
   * 이동수단별 한 구간 최대 이동 거리(m).
   * FAMILY(가족과 함께)는 이동 부담을 줄이기 위해 구간을 더 촘촘하게 잡는다.
   */
  private maxLegMeters(transport: Transport, style: Style): number {
    const base = (() => {
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
    })();
    return style === Style.FAMILY ? Math.round(base * FAMILY_LEG_RATIO) : base;
  }

  /** "HH:mm" → 자정 기준 분. 형식이 아니면 null(호출부에서 기본값 10:00 사용) */
  private parseStartTime(time?: string): number | null {
    if (!time) return null;
    const m = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(time);
    if (!m) return null;
    return Number(m[1]) * 60 + Number(m[2]);
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
   * 단, 첫 스팟(route.length===0)은 maxLeg 를 적용하지 않는다 — 사용자가 고른
   * 역/터미널(startMapX/Y)이 그 감성존의 관광지 밀집 지역과 멀리 떨어져 있으면
   * 첫 구간부터 후보가 0개가 되어 코스 전체가 빈 채로 반환되는 문제가 있었다.
   * (두 번째 스팟부터는 기존처럼 엄격하게 maxLeg 를 지킨다)
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
      const scored = pool.map((c, i) => ({
        item: c,
        poolIdx: i,
        adj: haversineMeters(cursor, c.pos) - c.score * 300,
      }));
      const inRange = (
        route.length === 0
          ? scored
          : scored.filter((x) => haversineMeters(cursor, x.item.pos) <= maxLeg)
      ).sort((a, b) => a.adj - b.adj);
      if (inRange.length === 0) break;
      const top = inRange.slice(0, Math.min(3, inRange.length));
      // 가까울수록(앞 순위) 큰 가중치
      const weighted = top.map((x, idx) => ({
        ...x,
        weight: top.length - idx,
      }));
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
      // 첫 스팟(route.length===0)은 maxLeg 를 적용하지 않는다 — routeNearestRandom 과 동일한 이유
      // (역/터미널 출발점이 관광지 밀집 지역과 멀면 첫 구간에서 후보가 0개가 되는 문제 방지)
      if (!pick) {
        const inRange = (
          route.length === 0
            ? pool
            : pool.filter((c) => haversineMeters(cursor, c.pos) <= maxLeg)
        ).sort(
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

  /** 반경을 벗어나도 억지로 넣기보다 생략하는 게 나은 지점 — maxLeg 의 몇 배까지 봐줄지 */
  private static readonly NEAR_RANDOM_RELAX_FACTOR = 3;

  /**
   * 기준점 인근 미사용 후보 상위 5곳 중 가중 랜덤 1곳 (점심/저녁/숙소용).
   * maxLeg 을 주면 그 반경 내 후보를 우선하고, 없으면 maxLeg*3 까지 완화해서 찾는다.
   * 그마저도 없으면 억지로 아주 먼 곳을 끼워 넣지 않고 null(생략)을 반환한다 —
   * 예전엔 "전체 중 가장 가까운 곳"으로 무제한 폴백해서 존별 데이터 밀도가 낮을 때
   * 수십 km 떨어진 식당/숙소가 끼어드는 문제가 있었다.
   */
  private pickNearRandom(
    candidates: Candidate[],
    from: LatLng,
    used: Set<string>,
    rng: Rng,
    maxLeg?: number,
  ): Candidate | null {
    const avail = candidates
      .filter((c) => !used.has(c.raw.contentid))
      .map((c) => ({ item: c, d: haversineMeters(from, c.pos) }))
      .sort((a, b) => a.d - b.d);
    if (avail.length === 0) return null;

    let pool = avail;
    if (maxLeg) {
      const strict = avail.filter((x) => x.d <= maxLeg);
      const relaxed =
        strict.length > 0
          ? strict
          : avail.filter(
              (x) => x.d <= maxLeg * CourseService.NEAR_RANDOM_RELAX_FACTOR,
            );
      if (relaxed.length === 0) return null;
      pool = relaxed;
    }

    const top = pool
      .slice(0, Math.min(5, pool.length))
      .map((x, idx) => ({ item: x.item, weight: 5 - idx }));
    return this.weightedPick(top, rng).item;
  }

  /**
   * from(직전 지점)·to(바로 다음 방문지) 양쪽 모두 maxLeg 이내인 후보 중 가중 랜덤 1곳.
   * 동선 중간에 끼워 넣는 점심처럼, 앞뒤 두 구간이 전부 이동 범위를 지켜야 할 때 사용.
   * (한쪽만 보면 반대쪽 구간에서 다시 튈 수 있음)
   */
  private pickNearRandomOnPath(
    candidates: Candidate[],
    from: LatLng,
    to: LatLng,
    used: Set<string>,
    rng: Rng,
    maxLeg: number,
  ): Candidate | null {
    const avail = candidates
      .filter((c) => !used.has(c.raw.contentid))
      .map((c) => ({
        item: c,
        d1: haversineMeters(from, c.pos),
        d2: haversineMeters(c.pos, to),
      }));
    if (avail.length === 0) return null;

    const within = (limit: number) =>
      avail.filter((x) => x.d1 <= limit && x.d2 <= limit);

    const strict = within(maxLeg);
    const relaxed =
      strict.length > 0
        ? strict
        : within(maxLeg * CourseService.NEAR_RANDOM_RELAX_FACTOR);
    if (relaxed.length === 0) return null;

    const sorted = [...relaxed].sort((a, b) => a.d1 + a.d2 - (b.d1 + b.d2));
    const top = sorted
      .slice(0, Math.min(5, sorted.length))
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

  /**
   * 하루 동선 + 점심(+ 마지막 날은 저녁) + 숙소를 시간표로 배치.
   * 점심/저녁/숙소는 "끼워 넣을 시점의 직전 위치"를 기준으로 그 자리에서 고른다.
   * (동선 중간 어딘가의 좌표를 미리 골라두면, 실제로 스플라이스되는 지점의
   *  앞/뒤 구간이 maxLeg 를 벗어날 수 있어 반드시 prevPos 기준으로 즉석에서 선택해야 함)
   */
  private buildItinerary(
    spots: Candidate[],
    restaurantPool: Candidate[],
    stayPool: Candidate[] | null,
    includeDinner: boolean,
    start: LatLng,
    transport: Transport,
    dayStart: number,
    spotStayMin: number,
    used: Set<string>,
    rng: Rng,
    maxLeg: number,
  ): CourseItemDto[] {
    const items: CourseItemDto[] = [];
    let clock = dayStart;
    let prevPos = start;
    let mealInserted = false;

    const push = (
      c: Candidate,
      type: CourseItemType,
      stayMin: number,
    ): void => {
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

    const pickMeal = (): Candidate | null =>
      this.pickNearRandom(restaurantPool, prevPos, used, rng, maxLeg);

    for (const spot of spots) {
      if (!mealInserted && clock >= LUNCH_AFTER) {
        // 동선 중간에 끼워 넣는 점심은 "직전 지점"뿐 아니라 "바로 다음 관광지"까지도
        // maxLeg 이내여야 함 — 안 그러면 점심 다음 구간에서 다시 멀리 튈 수 있음
        const meal = this.pickNearRandomOnPath(
          restaurantPool,
          prevPos,
          spot.pos,
          used,
          rng,
          maxLeg,
        );
        if (meal) {
          push(meal, CourseItemType.MEAL, MEAL_STAY_MIN);
          used.add(meal.raw.contentid);
          mealInserted = true;
        }
      }
      push(spot, CourseItemType.SPOT, spotStayMin);
    }
    if (!mealInserted) {
      const meal = pickMeal();
      if (meal) {
        push(meal, CourseItemType.MEAL, MEAL_STAY_MIN);
        used.add(meal.raw.contentid);
      }
    }
    if (includeDinner) {
      const dinner = pickMeal();
      if (dinner) {
        push(dinner, CourseItemType.MEAL, MEAL_STAY_MIN);
        used.add(dinner.raw.contentid);
      }
    }
    if (stayPool) {
      const stay = this.pickNearRandom(stayPool, prevPos, used, rng, maxLeg);
      if (stay) {
        push(stay, CourseItemType.STAY, 0);
        used.add(stay.raw.contentid);
      }
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
