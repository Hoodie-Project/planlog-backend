/**
 * 강원도 도메인 상수 — 제안서의 "5개 감성 존" 재구성을 코드화.
 * TourAPI 강원도 areaCode = 32. 감성존 = 시군구(sigunguCode) 그룹.
 *
 * ⚠️ 시군구 코드는 TourAPI(KorService2) areaCode2 오퍼레이션 표준값 기준이며,
 *    실제 응답과 다르면 GET /spots/area-codes 로 조회해 본 상수를 보정한다.
 */
export const GANGWON_AREA_CODE = '32';

/** 5개 감성 존 */
export enum Zone {
  SEA = 'SEA', // 동해 바다존
  SNOW = 'SNOW', // 설원·산악존
  VALLEY = 'VALLEY', // 계곡·자연존
  RETRO = 'RETRO', // 레트로·문화존
  PHOTO = 'PHOTO', // 절경·포토존
}

/** 이동 수단 (뚜벅이/KTX/렌터카) */
export enum Transport {
  WALK = 'WALK',
  KTX = 'KTX',
  CAR = 'CAR',
}

/** 여행 스타일 (혼자/반려동물) */
export enum Style {
  SOLO = 'SOLO',
  PET = 'PET',
}

/** KorService2 contentTypeId */
export enum ContentType {
  TOURIST_SPOT = '12', // 관광지
  CULTURE = '14', // 문화시설
  FESTIVAL = '15', // 축제공연행사
  TRAVEL_COURSE = '25', // 여행코스
  LEPORTS = '28', // 레포츠
  STAY = '32', // 숙박
  SHOPPING = '38', // 쇼핑
  RESTAURANT = '39', // 음식점
}

interface ZoneMeta {
  /** 감성존 한글 라벨 */
  label: string;
  /** 핵심 거점 시군 이름 */
  cities: string[];
  /** 강원 areaCode=32 기준 시군구 코드 */
  sigunguCodes: string[];
  /** 감성 태그 매핑용 대표 키워드(관광지명·행사명 파싱 시드) */
  keywords: string[];
}

export const ZONE_META: Record<Zone, ZoneMeta> = {
  [Zone.SEA]: {
    label: '동해 바다존',
    cities: ['강릉', '양양', '속초'],
    sigunguCodes: ['1', '7', '5'],
    keywords: ['바다', '해변', '해수욕장', '일출', '등대', '서핑', '항구', '오죽헌', '해안', '포구', '경포'],
  },
  [Zone.SNOW]: {
    label: '설원·산악존',
    cities: ['평창', '인제', '홍천'],
    sigunguCodes: ['15', '10', '16'],
    keywords: ['설원', '목장', '스키', '산', '트레킹', '대관령', '오대산', '눈', '스키장', '자연휴양림', '방태산'],
  },
  [Zone.VALLEY]: {
    label: '계곡·자연존',
    cities: ['춘천', '화천', '양구'],
    sigunguCodes: ['13', '17', '6'],
    keywords: ['계곡', '호수', '댐', '스카이워크', '소양강', '평화의댐', '출렁다리', '레일바이크', '비목'],
  },
  [Zone.RETRO]: {
    label: '레트로·문화존',
    cities: ['강릉', '원주'],
    sigunguCodes: ['1', '9'],
    keywords: ['시장', '커피', '거리', '뮤지엄', '미술관', '레트로', '구도심', '문화', '박물관', '카페', '한옥', '서원'],
  },
  [Zone.PHOTO]: {
    label: '절경·포토존',
    cities: ['정선', '태백', '삼척'],
    sigunguCodes: ['11', '14', '4'],
    keywords: ['절경', '전망', '동굴', '폭포', '만항재', '태백산', '포토', '환선굴', '전망대', '케이블카', '해신당', '협곡'],
  },
};

/**
 * 한국관광 데이터랩(빅데이터·연관관광지) 행정 시군구 코드 — 강원=51xxx.
 * ⚠️ KorService2 의 시군구 코드(강릉=1 등)와 체계가 다르다(이건 행정표준코드).
 */
export const ZONE_DL_SIGUNGU: Record<Zone, string[]> = {
  [Zone.SEA]: ['51150', '51830', '51210'], // 강릉 양양 속초
  [Zone.SNOW]: ['51760', '51810', '51720'], // 평창 인제 홍천
  [Zone.VALLEY]: ['51110', '51790', '51800'], // 춘천 화천 양구
  [Zone.RETRO]: ['51150', '51130'], // 강릉 원주
  [Zone.PHOTO]: ['51770', '51190', '51230'], // 정선 태백 삼척
};

/**
 * 관광지명/행사명을 5개 감성존으로 추정 분류 (감성 태그 매핑).
 * 점수제: 키워드 1건당 +2, 시군구 일치 +1 → 최고점 존 선택(순서 편향 제거).
 * @param text 관광지명/행사명 (+주소 등 부가 텍스트 합쳐 넣으면 정확도↑)
 * @param sigunguCode KorService2 시군구 코드
 */
export function inferZone(
  text: string | undefined,
  sigunguCode?: string,
): Zone | null {
  const scores = new Map<Zone, number>();
  const add = (zone: Zone, n: number) =>
    scores.set(zone, (scores.get(zone) ?? 0) + n);

  if (text) {
    for (const zone of Object.values(Zone)) {
      for (const kw of ZONE_META[zone].keywords) {
        if (text.includes(kw)) add(zone, 2);
      }
    }
  }
  if (sigunguCode) {
    for (const zone of Object.values(Zone)) {
      if (ZONE_META[zone].sigunguCodes.includes(sigunguCode)) add(zone, 1);
    }
  }

  let best: Zone | null = null;
  let bestScore = 0;
  for (const zone of Object.values(Zone)) {
    const s = scores.get(zone) ?? 0;
    if (s > bestScore) {
      bestScore = s;
      best = zone;
    }
  }
  return best;
}
