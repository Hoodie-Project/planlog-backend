# PLANLOG Backend

> **감성만 고르면, 여행이 완성된다** — 강원도 혼행 특화 여행 큐레이션 플랫폼
> 2026 관광데이터 활용 공모전 (웹·앱 개발 부문)

감성존·이동수단·여행스타일만 선택하면 강원도 혼행 **코스·숙소·축제·이동 동선**을 통합 자동 설계합니다.
모든 관광 데이터는 **한국관광공사 TourAPI를 실시간 호출·재해석**하여 제공합니다. (DB엔 관광 원본을 적재하지 않음)

---

## 기능 한눈에 보기

| 기능 | 엔드포인트 | 설명 |
|---|---|---|
| **코스 자동 생성** ⭐ | `POST /courses/generate` | 무드 입력 → 관광지+점심+숙소를 동선·시간표로 자동 설계 (다박·연관동선·혼잡회피·다양성) |
| 관광지 조회 | `GET /spots`, `/spots/location`, `/spots/{id}`, `/spots/{id}/images` | 감성존/위치 기반 조회·상세·이미지 |
| 주말 HOT 축제 | `GET /festivals` | 이번 주 금·토·일 축제 우선 |
| 혼행 맞춤 숙소 | `GET /accommodations` | 가성비/교류형/감성힐링/캠핑 4유형 분류 |
| 강원 캠핑 | `GET /campings` | 고캠핑 (반려동물 필터) |
| 혼잡도 | `GET /congestion` | 강원 요일별 관광 혼잡도 + 한산한 요일 추천 |
| 연관 관광지 | `GET /related-spots` | "함께 가는" 스팟 (코스 동선 연결에도 활용) |
| 반려동물 동반 | `GET /pet-spots`, `/pet-spots/{id}/info` | 동반 가능 장소 목록·동반 조건 |
| 인증 | `POST /auth/kakao`, `/auth/guest`, `GET /auth/me` | 카카오 로그인 / 게스트(심사용) / 내 정보 |
| 코스 저장 🔒 | `POST/GET/DELETE /saved-courses` | 생성 코스 저장·조회·삭제 |
| 찜 🔒 | `POST/GET/DELETE /bookmarks`, `GET /bookmarks/upcoming` | 축제·관광지·코스 찜 + D-Day 임박 목록 |
| 감성 스탬프 🔒 | `POST/GET /stamps`, `GET /stamps/progress` | 방문 인증 + 5존 완주 리워드 |
| 동선 매칭 🔒 | `POST /matches/opt-in`, `GET /matches` … | 동일 존·날짜 여행 메이트 (상호 옵트인) |

🔒 = JWT 인증 필요. 전체 요청/응답 규격은 **Swagger** `http://localhost:3000/api-docs`

### 강원 5개 감성존
강원도(`areaCode=32`)를 5개 감성 존으로 재구성 — 거점 시군 + 키워드로 분류 (`src/common/gangwon.constants.ts`)

| 존 | 거점 시군 | 대표 키워드 |
|---|---|---|
| `SEA` 동해 바다존 | 강릉·양양·속초 | 바다·해변·일출·등대·서핑 |
| `SNOW` 설원·산악존 | 평창·인제·홍천 | 설원·목장·스키·대관령·트레킹 |
| `VALLEY` 계곡·자연존 | 춘천·화천·양구 | 계곡·호수·댐·스카이워크 |
| `RETRO` 레트로·문화존 | 강릉·원주 | 시장·커피·박물관·구도심 |
| `PHOTO` 절경·포토존 | 정선·태백·삼척 | 동굴·폭포·전망대·케이블카 |

---

## 활용한 한국관광공사 OpenAPI (data.go.kr)

> 단순 프록시가 아니라, 공공데이터에 **감성·맥락 레이어를 입혀 재해석**합니다.

| OpenAPI 서비스 | 엔드포인트(오퍼레이션) | 활용 기능 |
|---|---|---|
| **국문 관광정보 서비스** | `KorService2` · areaBasedList2 / locationBasedList2 / searchFestival2 / searchStay2 / detailCommon2 / detailIntro2 / detailImage2 / areaCode2 / detailPetTour2 | 관광지·축제·숙소 조회, 상세/이미지, 반려동물 동반조건, 코스 재료 |
| **고캠핑 정보 조회서비스** | `GoCamping` · basedList | 강원 캠핑장 (반려동물 동반 여부) |
| **관광지별 연관 관광지 정보** | `TarRlteTarService1` · areaBasedList1 | "함께 가는" 스팟 → 코스 동선 자동 연결 |
| **관광지 집중률·방문자 추이** | `DataLabService` · metcoRegnVisitrDDList | 강원 요일별 혼잡도 → 혼잡 회피 |
| **반려동물 동반여행 서비스** | `KorPetTourService2` · areaBasedList2 | 반려동물 동반 가능 장소 |

> ※ 지도/경로/길찾기는 카카오맵·카카오내비 API 연동 예정(좌표는 본 API가 제공). 로그인은 카카오 OAuth(`kapi.kakao.com`).

### 데이터 가공 정도

| 엔드포인트 | 가공 | 내용 |
|---|---|---|
| `POST /courses/generate` | 🔥 무거움 | 3종 API 병렬 → 점수화 → 연관/거리 동선 → 시간표 → 일자 분할 |
| `/festivals` | 🟡 중간 | 이번 주말 겹침 계산 + 주말 우선 정렬 |
| `/accommodations` | 🟡 중간 | 혼행 4유형 분류 |
| `/congestion` | 🟡 중간 | 강원(51) 추출 → 요일별 집계 → 0~100 정규화 |
| `/related-spots` | 🟡 중간 | 기준 관광지별 연관 그룹화·순위 정렬 |
| `/spots` `/pet-spots` `/campings` | 🟢 가벼움 | 정규화 + 감성존 태깅 / 강원 필터 / 반려동물 여부 |

---

## 코스 생성 로직 (핵심)

```
입력: { zone, transport, style, spotCount, nights, travelDate?, seed?, startMapX/Y?, debug? }
  ① 재료 수집   감성존 시군구의 관광지·음식점·숙소 TourAPI 병렬 조회 → 좌표/점수화
                (style=PET이면 반려동물 동반 가능 관광지 우선)
  ② 연관 로드   연관관광지 맵 구성 → 인기(잘 연결된) 스팟 점수 가산
  ③ 동선 구성   밀집 클러스터에서 출발 → 직전 스팟의 "연관관광지" 우선 연결(없으면 거리 폴백)
                → 점심·숙소 삽입, 가중 랜덤으로 매번 변주
  ④ 시간표      10:00 시작, (거리÷속도) 이동 + 체류(관광지90·점심60분) 누적
  ⑤ 부가정보    travelDate→혼잡도, debug→연관 매칭 적중률
출력: days[](일자별 시간순 동선) + congestion? + relatedDebug?
```

| 규칙 | 값 |
|---|---|
| 한 구간 최대 이동 | 뚜벅이 2.5km / KTX 6km / 렌터카 30km |
| 이동 속도 | 도보 4 / KTX 30 / 렌터카 40 (km/h) |
| 체류 | 관광지 90분 · 점심 60분 |

---

## 기술 스택 · 아키텍처

- **NestJS 11** (TypeScript) · **Prisma 7** + MySQL 8(Docker) · **Swagger** · JWT(Passport)
- **원칙**
  1. 관광 데이터는 DB 미적재 — TourAPI 실시간 호출 + 30분 메모리 캐시
  2. DB엔 우리 서비스 데이터만 — 유저·저장코스·찜·스탬프·매칭 (관광지는 `contentId` 참조)
  3. 외부 호출은 `tour-api` 코어 모듈 단일 경유

```
src/
  tour-api/      # [코어] TourAPI 클라이언트 + 캐시 + 응답 정규화
  common/        # 감성존 상수·거리/도보 계산·공통 DTO
  course/        # 코스 자동 생성 (오케스트레이터)
  spot/ festival/ accommodation/ camping/   # 조회 도메인
  congestion/ related/ pet/                 # 혼잡도·연관·반려동물 (TourAPI 가공)
  auth/ saved-course/ bookmark/ stamp/ match/  # 유저 기능 (DB)
  prisma/
docs/ROADMAP.md
```

---

## 시작하기

```bash
npm install
docker compose up -d         # MySQL 8
npx prisma migrate dev       # 스키마 적용
npm run start:dev            # http://localhost:3000 (Swagger: /api-docs)
```

### 환경변수 (`.env`)
```bash
DATABASE_URL="mysql://planlog:planlog@localhost:3306/planlog"

# 한국관광공사 TourAPI — 반드시 Encoding 인증키 (계정당 1개, 모든 API 공유)
TOUR_API_KEY="발급받은_Encoding_인증키"
TOUR_API_BASE_URL="https://apis.data.go.kr/B551011"
TOUR_API_APP_NAME="PLANLOG"

# 인증 (운영 시 교체)
JWT_SECRET="change-me"
JWT_EXPIRES_IN="30d"
```

자세한 단계별 개발 로드맵은 [`docs/ROADMAP.md`](docs/ROADMAP.md) 참고.
