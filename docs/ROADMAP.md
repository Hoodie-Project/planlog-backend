# PLANLOG 백엔드 개발 로드맵

> 감성만 고르면, 여행이 완성된다 — 강원도 혼행 특화 여행 큐레이션 플랫폼
> 기준 제안서: `../『2026_관광데이터_활용_공모전』_제안서_후디브.pdf`

## 0. 핵심 결정 사항 (확정)

| 항목 | 결정 |
| --- | --- |
| 데이터 소스 | 한국관광공사 TourAPI **실시간 호출 위주** (필수 활용) |
| DB 역할 | 우리 서비스 데이터만 저장 (유저·코스·찜·스탬프·매칭·알림). 관광 원본 데이터는 저장 안 함 |
| 지도/경로 | 카카오맵·카카오내비 API 연동 (후순위) |
| 스택 | NestJS 11 + Prisma 7(MySQL) + Swagger |

> 캐싱 메모: 관광 데이터를 DB에 적재하지는 않되, 호출량/응답속도 때문에 **단기 메모리 캐시(예: cache-manager TTL 수십 분)** 는 둔다. "DB 적재"와 "응답 캐시"는 구분.

---

## 1. 서비스 → 기능 → TourAPI 매핑

제안서의 기능을 실제 API와 연결한 표. 개발 순서의 기준이 된다.

| 기능 (제안서) | 핵심 로직 | 사용 TourAPI |
| --- | --- | --- |
| 무드 셀렉터 | 5감성존·이동수단·스타일 입력 → 필터 파라미터로 변환 | (입력 처리, API 직접 호출 없음) |
| 통합 코스 자동 생성 | 감성태그 + 연관도 + 이동시간 + 혼잡도 → 하루 동선 | 지역기반관광정보 + 연관관광지 + 집중률 |
| 주말 HOT 축제 탭 | 이번 주 금·토·일 행사 우선 + 동반자 태그 분류 | 행사/축제정보 `searchFestival` |
| 혼행 맞춤 숙소 | 가성비·교류형·감성힐링·캠핑 4유형 + 반려동물 필터 | 숙박정보 `searchStay` + 고캠핑 + 반려동물 |
| 뚜벅이 최적 동선 | KTX·SRT 역 반경 내 필터 + 도보(4km/h) 이동가능 스팟 | 위치기반관광정보 `locationBasedList` |
| 혼잡 시간대 회피 | 향후 30일 집중률 예측 → 피크 회피·방문시간 배치 | 관광지 집중률/방문자 추이 예측 |
| 감성 스탬프 투어 | 코스 내 관광지 실제 방문 도장, 5존 완주 리워드 | (우리 DB. 관광지 식별은 contentId) |
| 동선 매칭 (메이트) | 동일 지역·날짜 코스 보유 유저 옵트인 매칭 | (우리 DB) |
| 찜·D-Day 알림 | 축제·코스 찜 + 시작 전날/당일 푸시 | (우리 DB + 푸시) |
| 감성 인증 카드 | 대표 이미지 + 코스 정보 결합 카드 생성 | 이미지정보 `detailImage` |

### 활용 TourAPI 서비스 목록 (data.go.kr)

| API 서비스 | 용도 | 비고 |
| --- | --- | --- |
| 국문 관광정보 서비스 (KorService) | 지역기반/위치기반 조회, 축제, 숙박, 공통/소개/이미지 정보 | 메인. 오퍼레이션 15종 |
| 관광지별 연관 관광지 정보 | 스팟 간 연관성 → 동선 자동 연결 | 코스 생성 핵심 |
| 관광지 집중률 방문자 추이 예측 | 향후 30일 혼잡도 예측 | 혼잡 회피 |
| 반려동물 동반여행 서비스 | 반려동물 동반 가능 장소 | 숙소/스팟 필터 |
| 고캠핑 정보 조회 서비스 | 캠핑장 위치·시설 | 숙소 캠핑 유형 |

> ⚠️ data.go.kr의 오퍼레이션 버전(`...List1`, `...List2` 등)은 신청 시점에 확인. 키 발급 후 실제 엔드포인트/파라미터를 `tour-api` 모듈 상수로 고정한다.

---

## 2. 강원도 감성존 매핑 (도메인 상수)

TourAPI 강원도 `areaCode = 32`. 5개 감성존 = 시군구(sigunguCode) 그룹.
시군구 코드는 키 발급 후 `areaCode` 오퍼레이션으로 조회해 채운다.

| 감성존 (zone) | 핵심 거점 시군 | 대표 경험 (키워드 매핑 시드) |
| --- | --- | --- |
| `SEA` 동해 바다존 | 강릉·양양·속초 | 정동진 일출, 서퍼비치, 주문진 등대, 오죽헌 |
| `SNOW` 설원·산악존 | 평창·인제·홍천 | 대관령 양떼목장, 오대산, 방태산 트레킹 |
| `VALLEY` 계곡·자연존 | 춘천·화천·양구 | 소양강 스카이워크, 비목공원, 평화의 댐 |
| `RETRO` 레트로·문화존 | 강릉 구도심·원주 | 중앙시장, 커피거리, 뮤지엄 산 |
| `PHOTO` 절경·포토존 | 정선·태백·삼척 | 만항재, 환선굴, 해신당공원, 태백산 |

> 감성 태그 매핑: 관광지명·행사명 키워드 파싱 → 위 zone 자동 분류 (제안서 "감성 태그 매핑").

---

## 3. 모듈 구조 (NestJS)

```
src/
  tour-api/            # [코어] TourAPI HTTP 클라이언트 + 응답 정규화
    tour-api.module.ts
    tour-api.service.ts        # 공통 호출(serviceKey, 페이징, 에러/재시도)
    clients/
      kor-service.client.ts    # 국문 관광정보 (지역/위치/축제/숙박/상세/이미지)
      related-spot.client.ts   # 연관 관광지
      congestion.client.ts     # 집중률 예측
      pet-tour.client.ts       # 반려동물
      gocamping.client.ts      # 고캠핑
    dto/                       # API raw 응답 → 내부 모델 정규화 DTO
  common/              # 감성존 상수, 거리/도보시간 계산, 공통 유틸
  mood/                # 무드 셀렉터 입력 → 검색 조건 변환
  spot/                # 관광지 조회 + 연관 관광지
  festival/            # 주말 HOT 축제
  accommodation/       # 숙소(+캠핑+반려동물) 추천
  course/              # 통합 코스 자동 생성 (동선/혼잡도/뚜벅이)
  stamp/               # 감성 스탬프 투어        [DB]
  match/               # 동선 매칭 (메이트)       [DB]
  bookmark/            # 찜                       [DB]
  notification/        # D-Day 알림 + 푸시         [DB]
  auth/ user/          # 인증/유저                [DB]
  prisma/              # (기존)
```

원칙: 관광 데이터는 `tour-api` 모듈만 외부 호출하고, 도메인 모듈은 정규화된 내부 모델만 받는다. 나중에 캐시/DB적재로 바꿔도 도메인 모듈은 그대로.

---

## 4. DB 스키마 초안 (Prisma — 우리 서비스 데이터만)

관광지/축제/숙소는 저장하지 않고 **TourAPI `contentId`로 참조**만 한다.

```prisma
model User {
  id        String   @id @default(cuid())
  email     String   @unique
  nickname  String
  createdAt DateTime @default(now())
  courses     Course[]
  bookmarks   Bookmark[]
  stamps      Stamp[]
  matchOptIns MatchOptIn[]
}

model Course {                 // 생성/저장된 하루 코스
  id        String   @id @default(cuid())
  userId    String
  user      User     @relation(fields: [userId], references: [id])
  zone      String   // SEA | SNOW | VALLEY | RETRO | PHOTO
  transport String   // WALK | KTX | CAR  (뚜벅이/KTX/렌터카)
  style     String   // SOLO | PET
  travelDate DateTime
  spots     CourseSpot[]
  createdAt DateTime @default(now())
}

model CourseSpot {             // 코스 내 관광지(순서 있음). contentId로 TourAPI 참조
  id         String  @id @default(cuid())
  courseId   String
  course     Course  @relation(fields: [courseId], references: [id])
  contentId  String  // TourAPI contentId
  contentTypeId String?
  title      String  // 스냅샷(표시용)
  orderIndex Int
  visitFrom  DateTime?  // 혼잡 회피로 배치된 방문 시간대
}

model Bookmark {               // 찜 (축제/코스)
  id        String   @id @default(cuid())
  userId    String
  user      User     @relation(fields: [userId], references: [id])
  targetType String  // FESTIVAL | COURSE
  targetId  String   // festival=contentId, course=Course.id
  dDayDate  DateTime?  // 알림 기준일
  createdAt DateTime @default(now())
}

model Stamp {                  // 감성 스탬프 (방문 인증)
  id        String   @id @default(cuid())
  userId    String
  user      User     @relation(fields: [userId], references: [id])
  zone      String   // 5존 중 하나
  contentId String   // 방문한 관광지
  visitedAt DateTime @default(now())
}

model MatchOptIn {             // 동선 매칭 옵트인
  id        String   @id @default(cuid())
  userId    String
  user      User     @relation(fields: [userId], references: [id])
  zone      String
  travelDate DateTime
  createdAt DateTime @default(now())
}
```

> Notification/DeviceToken은 알림 단계에서 추가.

---

## 5. 단계별 개발 순서 (Phase)

### Phase 0 — 사전 준비
- [ ] data.go.kr에서 TourAPI 서비스키 발급 (아래 6장 가이드)
- [ ] `.env`에 `TOUR_API_KEY`, `TOUR_API_BASE_URL` 추가
- [ ] `@nestjs/axios`(또는 fetch) + `@nestjs/cache-manager` 설치

### Phase 1 — TourAPI 연동 코어 ⭐ (모든 기능의 기반)
- [ ] `tour-api.module.ts` + 공통 호출(serviceKey 주입, 페이징, 에러 핸들링, 재시도)
- [ ] KorService 클라이언트: 지역기반/위치기반/축제/숙박/상세/이미지 오퍼레이션
- [ ] raw 응답 → 내부 정규화 DTO (contentId, title, mapx/mapy, addr, image 등)
- [ ] 키 없을 때를 대비한 목(mock) 응답 토글 (개발 병행용)

### Phase 2 — 도메인 조회 기능 (실시간 호출 검증)
- [ ] `common`: 감성존 상수(2장) + 시군구 코드 채우기 + 거리/도보시간 유틸
- [ ] `mood`: 무드 입력 DTO → 검색 조건 변환
- [ ] `festival`: 주말 HOT 축제 (이번 주 금·토·일 필터 + 동반자 태그)
- [ ] `spot`: 지역/위치 기반 관광지 조회 + 감성존 키워드 매핑 + 연관 관광지
- [ ] `accommodation`: 숙박 + 고캠핑 + 반려동물 필터 → 4유형 분류

### Phase 3 — 코스 자동 생성 (핵심 가치)
- [ ] 뚜벅이 동선: KTX/SRT 역 좌표 반경 + 도보 4km/h 이동가능 필터
- [ ] 혼잡 회피: 집중률 예측 → 피크 회피 + 방문시간 배치
- [ ] 통합 코스: 감성존 스팟 → 연관도·이동시간 최적화 → 하루 동선 + 저장

### Phase 4 — 유저 기능 (DB 중심)
- [ ] `auth`/`user`: 가입/로그인(JWT)
- [ ] `bookmark`: 찜 + D-Day
- [ ] `notification`: 시작 전날/당일 푸시 (스케줄러)
- [ ] `stamp`: 방문 인증 + 5존 완주 리워드
- [ ] `match`: 동일 지역·날짜 옵트인 매칭

### Phase 5 — 확장 (후순위)
- [ ] 감성 인증 카드(이미지 결합)
- [ ] 카카오맵/내비 연동
- [ ] 다국어 관광정보 API

---

## 6. TourAPI 서비스키 발급 가이드 (Phase 0 블로커)

1. https://www.data.go.kr 회원가입/로그인
2. "한국관광공사_국문 관광정보 서비스" 검색 → **활용신청** (개발계정 즉시 승인)
3. 동일하게 신청: 연관 관광지 / 집중률 예측 / 반려동물 동반여행 / 고캠핑
4. 마이페이지 → 활용신청 현황 → **일반 인증키(Encoding/Decoding)** 확인
5. `.env`에 추가:
   ```
   TOUR_API_KEY="발급받은_인증키"
   TOUR_API_BASE_URL="https://apis.data.go.kr/B551011"
   ```
   > Encoding 키는 URL 인코딩된 형태. 코드에서 직접 쿼리에 붙일지(Encoding) vs 라이브러리가 인코딩(Decoding)할지 한쪽으로 통일.

키가 없는 동안에는 Phase 1의 mock 토글로 코드 골격을 먼저 완성한다.

---

## 7. 다음 액션

키 발급 여부와 무관하게 **Phase 1 (tour-api 코어 모듈)** 부터 시작.
키가 있으면 실제 호출로, 없으면 mock 응답으로 골격을 세운 뒤 키 발급 시 교체.
