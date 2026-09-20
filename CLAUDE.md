# CLAUDE.md — planlog-backend

이 파일은 미래 세션(또는 계속되는 이 세션)이 맥락을 다시 파악하는 데 드는 시간을 줄이기 위한
**사실 기반** 요약이다. 추측이나 계획이 아니라 "지금 코드에 실제로 있는 것"만 적는다.
일반적인 기능 소개는 `README.md`, 배포/장애복구는 `DEPLOY.md` 참고. 이 문서는 그 둘에 없는
**구현 세부사항·최근 결정·현재 진행 상태**를 보완한다.

마지막 갱신: 2026-09-20

---

## 1. 이 프로젝트가 뭔지 (한 줄)

강원도 혼행 여행 코스를 자동 생성(TourAPI 실시간 조회, DB에 관광 원본 미적재)하고,
저장→시작→종료(리뷰)→스탬프 흐름으로 실제 방문 경험을 기록하게 하는 NestJS 백엔드.
2026 관광데이터 활용 공모전 출품작. 프론트는 `../planlog-frontend`(Next.js), 같은 macmini에
pm2로 함께 배포됨(운영 서버 별도 없음 — `DEPLOY.md` 참고).

## 2. 실행 환경 — 이미 떠 있는 것들 (헷갈리지 말 것)

- **개발 = 운영이 같은 머신**. `pm2 list`에 `planlog-backend`(포트 9000), `planlog-frontend-main/dev`,
  `glance-*`(이 프로젝트와 무관) 가 상시 떠 있음.
- **로컬에서 `node dist/src/main.js`로 직접 띄우지 말 것** — pm2가 이미 같은 포트(9000)를 쓰고 있어서
  충돌 시 DB 커넥션 풀이 고갈되며 pm2 프로세스가 재시작을 반복한다. 코드 변경 후엔
  `npm run build && pm2 restart planlog-backend`만 쓴다.
- DB는 Docker `planlog-mysql`(MySQL 8, 포트 3306) 하나뿐. 별도 스테이징/운영 DB 없음 —
  `npx prisma migrate dev`가 곧 "운영 반영"이다.
- `npx prisma migrate dev`를 처음 이 세션에서 돌릴 때 `P3014`(shadow DB 권한 에러)가 났었음 →
  `GRANT ALL PRIVILEGES ON *.* TO 'planlog'@'%'`로 해결(이미 적용됨, 재발 시 참고).

## 3. 기술 스택 / 도메인 규칙

- NestJS 11 + TypeScript, Prisma 7(MySQL, mariadb adapter) + Swagger + JWT(Passport)
- 감성존 5개(SEA/SNOW/VALLEY/RETRO/PHOTO), 이동수단 3종(WALK/KTX/CAR),
  여행 스타일 4종(SOLO/FAMILY/PET/CALM) — 전부 `src/common/gangwon.constants.ts`
- 감정(Mood) 고정 8종 — `src/common/mood.constants.ts` (감사한/기분좋은/설렘/신나는/자유로움/즐거운/평온함/뿌듯한).
  리뷰 작성 모달의 "감정 선택" 칩과 정확히 일치해야 함(Figma 확인됨)
- TourAPI(한국관광공사 KorService2 등)는 `src/tour-api/tour-api.service.ts` 하나만 경유.
  30분 메모리 캐시. **`detailCommon2`에 `defaultYN`/`firstImageYN`/`addrinfoYN`/`mapinfoYN`/`overviewYN`
  파라미터를 주면 `INVALID_REQUEST_PARAMETER_ERROR`로 100% 실패한다**(TourAPI 스펙 변경, 2026-09-20
  발견·수정됨). `contentId`만 주면 overview 포함 전체가 기본으로 내려옴 — 이 패턴 유지할 것.
  TourAPI엔 기차역·버스터미널이 데이터로 없음(관광지가 아니라서) → `GET /stations`는 고정 상수.

### 코스 생성 알고리즘 (`src/course/course.service.ts`)

- 입력: zone(필수), transport/style(기본 WALK/SOLO), spotCount(2~5), nights(0~2),
  startTime(HH:mm, 기본 10:00), travelDate, seed, startMapX/Y, debug
- FAMILY: 한 구간 최대 이동거리 ×0.6, 관광지 체류 90→120분
- CALM: 연관관광지 다발(=인기) 스팟을 **감점**(스팟 단위 혼잡도 데이터가 없어 "인기=혼잡"으로 근사)
- PET: 반려동물 동반 가능 관광지 풀 우선 사용
- 규칙값: 뚜벅이 2.5km/KTX 6km/렌터카 30km(한 구간 최대), 도보4·KTX30·렌터카40 km/h

## 4. 저장 코스 상태 모델 (여러 번 정정된 부분 — 정확히 알아둘 것)

`SavedCourseStatus`(`src/saved-course/saved-course.service.ts`)는 DB에 저장하지 않고 매번 계산:

- **PENDING(대기중)**: `startedAt`도 `completedAt`도 없음
- **IN_PROGRESS(진행중)**: `startedAt`이 있음 — **`PATCH /saved-courses/:id/start` 버튼 클릭이 기준**.
  ⚠️ `travelDate`는 상태와 **무관**(다가오는 여행 D-Day 표시에만 씀). 초기엔 travelDate 유무로
  진행중을 판정했다가, 기획서("[코스 시작하기] 버튼 클릭 후 (진행중) 상태 노출") 확인 후 정정함.
- **COMPLETED(완료)**: `completedAt`이 있거나(`PATCH .../complete`로 강제), 이 코스로 리뷰
  (`TravelRecord.savedCourseId`)를 작성함. **리뷰 없이는 "코스 종료하기"만으로 완료 처리 안 됨**
  (Figma 와이어프레임 코멘트: "리뷰 안 남기면 코스 완료하기 안 됨" 확인됨).
- 프론트 `architecture.md`의 기존 설계는 대기중을 `WAITING`으로 명명 — 백엔드는 `PENDING`.
  연동 시 매핑 필요(아직 미연동, 2026-09-20 기준).

`stampProgress`(`{earned, total}`)는 `Stamp` 테이블에 `savedCourseId`가 없어서(리뷰 작성 시에만
간접 연결) 저장 코스 payload의 스팟 contentId와 유저의 스탬프 contentId를 매번 대조해서 계산함.
DB 스키마를 바꾸지 않고 이렇게 해결한 이유: 스탬프는 코스와 무관하게 독립적으로 찍을 수 있어야
해서(방문 인증이 먼저, 코스 연결은 나중 리뷰 시점) 생성 시점에 FK로 못 박기 어려움.

## 5. 스탬프 위치 검증 (`src/stamp/stamp.service.ts`)

- `POST /stamps`에 `curMapX`/`curMapY`(현재 위치)를 받아 **서버에서** 대상 관광지의 실제 좌표
  (TourAPI `detailCommon2` 기준 — 클라이언트가 보낸 좌표를 신뢰하지 않음)와 2km 이내인지 검증.
  초과하거나 좌표 자체가 없으면 400 거부.
- `User.isGuest === true`(게스트 로그인 = 심사자 계정)는 **위치 검증을 완전히 건너뜀** — 실제로
  안 가도 찍힘. 의도된 동작(공모전 심사용).
- `GET /stamps/eligibility`는 **실제로 찍지 않고** 5states(`ALREADY_STAMPED`/`REVIEWER`/
  `NO_LOCATION`/`TOO_FAR`/`ELIGIBLE`) 중 하나만 미리 알려주는 조회 전용 API. 버튼 디자인/비활성
  사유를 클릭 전에 렌더링하기 위한 보조 엔드포인트 — `POST /stamps`를 대체하는 게 아님.
- 좌표 확인 자체가 실패하면(우리 쪽 데이터 문제) 막지 않고 허용(fail-open).

## 6. 저장 코스 항목 교체/추가 (`PATCH /saved-courses/:id/items`)

- `day` + `order` 지정 → 기존 항목을 다른 후보로 **교체**. 그 날 이후 항목들의 거리/시간/도착시각을
  연쇄 재계산(코스 생성과 같은 haversine/travelMinutes 로직 재사용, `src/common/geo.ts`).
- `order` **생략** → **추가** 모드 — 그 날 마지막에 새 숙소(STAY) 항목을 추가("숙소 선택하기").
- ⚠️ 그 날의 "출발 앵커" 좌표는 payload에 저장돼 있지 않음(코스 생성 시 in-memory 변수였을 뿐).
  그래서 그 날 **1번째 항목을 교체**하면 그 항목을 새 출발점으로 재정의한다(이동거리 0으로 리셋,
  시작 시각만 유지). 이건 근본적으로 데이터 부족에 의한 설계 타협이며, 완벽한 해법이 아님 —
  나중에 CourseDayDto에 anchor 좌표를 별도 저장하면 더 정확해질 수 있음.
- 후보 조회: `GET /spots/location`(장소/점심, contentTypeId=39면 음식점), `GET /accommodations/location`
  (숙소, TourAPI엔 위치기반 숙소 조회 API가 따로 없어서 `locationBasedList2`를 contentTypeId=32로 호출).
  둘 다 `excludeContentIds`(쉼표구분)로 이미 코스에 있는 곳 제외 가능.

## 7. 장소/숙소 상세 — API가 분리돼 있음

- `GET /spots/{contentId}`: 관광지 공통정보 + `detailIntro2`(이용시간/쉬는날/주차/유모차/반려동물/
  신용카드). **OptionalJwtAuthGuard** 사용 — 로그인 없이도 동작하고, 유효한 JWT를 보내면 응답에
  `stamped`/`visitedAt`(이 유저가 이미 방문했는지)이 추가로 붙음. 로그인 필수 아님.
- `GET /accommodations/{contentId}`: 숙소 공통정보 + `detailIntro2`(체크인/체크아웃/객실수/취사/
  주차/부대시설 목록 등, contentTypeId=32 전용 필드라 관광지와 완전히 다름). 이래서 엔드포인트를
  분리함(같은 API로 합치면 필드가 안 맞음).
- 두 서비스 모두 위 3번 항목의 detailCommon2 파라미터 버그 수정이 적용돼 있어야 정상 동작함.

## 8. 인증

- 카카오(`POST /auth/kakao`) + 게스트(`POST /auth/guest`, 고정 계정 재사용, 심사용)만 지원.
- **구글 로그인은 명시적으로 보류 결정됨**(2026-09-20, 사용자 요청) — Client ID/Secret 없이는
  진행하지 말 것. `AuthProvider` enum에 `GOOGLE` 추가하는 작업을 먼저 제안하지 말 것.
- JWT: `JwtAuthGuard`(필수) / `OptionalJwtAuthGuard`(있으면 쓰고 없어도 통과, `src/auth/optional-jwt-auth.guard.ts`,
  `GET /spots/{contentId}`에서만 사용 중).

## 9. 전체 API 목록 (2026-09-20 기준, `GET /api/docs-json`으로 재생성 가능)

🔒 = JWT 필요. 전체 요청/응답 스펙은 `/api/docs`(Swagger)가 항상 최신(코드 데코레이터에서 자동 생성).

```
POST   /auth/guest                        게스트 로그인
POST   /auth/kakao                        카카오 로그인
GET    /auth/me                    🔒      내 정보
GET    /auth/me/stats              🔒      마이페이지 요약 통계
GET    /auth/me/recent-activities  🔒      최근 활동 피드

GET    /spots                             감성존 기반 관광지 조회 (excludeContentIds 지원)
GET    /spots/location                    위치기반 관광지 조회 (교체 후보용)
GET    /spots/{contentId}                 관광지 상세 (OptionalJwtAuthGuard)
GET    /spots/{contentId}/images          관광지 이미지 목록

GET    /accommodations                    혼행 숙소 조회 (excludeContentIds 지원)
GET    /accommodations/location           좌표 근처 숙소 조회 (교체 후보용)
GET    /accommodations/{contentId}        숙소 상세

GET    /festivals                         주말 HOT 축제
GET    /campings                          강원 고캠핑
GET    /congestion                        강원 요일별 혼잡도
GET    /related-spots                     연관 관광지
GET    /pet-spots, /pet-spots/{contentId}/info   반려동물 동반 장소

POST   /courses/generate                  코스 자동 생성 ⭐

POST   /saved-courses               🔒     코스 저장
GET    /saved-courses                🔒     내 저장 코스 목록 (?status= 필터)
GET    /saved-courses/upcoming       🔒     다가오는 여행 (D-Day)
GET    /saved-courses/{id}           🔒     저장 코스 상세 (stampProgress 포함)
PATCH  /saved-courses/{id}/items     🔒     항목 교체(order 지정)/추가(order 생략)
PATCH  /saved-courses/{id}/start     🔒     코스 시작하기
PATCH  /saved-courses/{id}/complete  🔒     강제 완료 처리
PATCH  /saved-courses/{id}/uncomplete 🔒    완료 취소
DELETE /saved-courses/{id}           🔒     삭제

POST   /stamps                       🔒     스탬프 찍기 (위치 검증, 게스트 예외)
GET    /stamps                       🔒     내 스탬프 목록 (?zone=&order=, mood 포함)
GET    /stamps/eligibility           🔒     버튼 상태만 확인(안 찍음)
GET    /stamps/progress              🔒     5존 완주 진행률
GET    /stamps/traits                🔒     스탬프 비중 기반 여행 성향

POST   /records                      🔒     리뷰(기록 카드) 작성 — mood는 고정 8종
GET    /records                      🔒     내 기록 목록
GET    /records/{id}                 🔒     기록 상세
DELETE /records/{id}                 🔒     기록 삭제 (⚠️ PATCH/수정 없음 — 의도적으로 미구현,
                                             "삭제 후 재작성"으로 충분하다고 결정함)
GET    /records/highlights           🔒     동행자 감정 후기
GET    /records/traits               🔒     리뷰 기반 여행 성향 + 대표 유형(ZONE_TRAVEL_TYPE)

POST/GET /bookmarks, GET /bookmarks/upcoming, DELETE /bookmarks/{id}   🔒
GET/PATCH /notification-settings     🔒
POST/GET /course-feedback            🔒
GET/POST/DELETE /matches, /matches/opt-in(s)  🔒

GET    /stations                          강원 기차역·버스터미널 목록 (?type=TRAIN|BUS)
                                           좌표: 기차역=위키백과, 버스터미널=OSM Nominatim
                                           지오코딩 근사치(도로 중심점, 실서비스 전 재검증 권장)
```

## 10. 알려진 미해결/보류 항목

- **"코스 후기" 탭**: Figma에 사이드바/탭 라벨만 있고 실제 화면 디자인이 아직 없음. 뭘 보여줄지
  (내 후기만? 남의 후기도?) 정해지지 않아 백엔드 설계 불가 — 착수 전.
- **구글 로그인**: 8번 항목 참고, 명시적 보류.
- **버스터미널 좌표**: 근사치, 정밀 검증 안 됨.
- **동행자 유형(FAMILY/CALM) 코스 생성 로직**: 기획 문서에 정확한 수치 스펙이 없어서
  백엔드가 합리적으로 판단해 구현함(이동거리 ×0.6, 체류 +30분, 인기 스팟 감점 등) — 기획
  의도와 다르면 조정 필요.
- **프론트 미연동 API 다수**: 2026-09-20 기준 프론트 `src/api/*`는 auth/bookmarks/courses/
  saved-courses(기본)/stamps(기본)만 호출 중. 이번 세션에서 만든 새 필드·엔드포인트
  (records 전체, stations, stamps eligibility, saved-courses start/complete/items,
  accommodations·spots detail 등)는 전부 백엔드만 준비된 상태.
- **Figma MCP 월간 호출 한도 소진**: 이 계정(hoodiev 팀, Starter 플랜 View 시트)은 월 20회 한도.
  2026-09-20에 다 씀 — 다음 달까지(또는 플랜 업그레이드 전까지) Figma 프레임을 직접 못 열어봄.
  스크린샷을 사용자에게 받아서 확인하는 방식으로 대체 가능.

## 11. 이 세션에서 확정한, 코드에 안 드러나는 제품 결정

- 저장 코스 "완료"는 리뷰 작성이 트리거(스탬프 개수와 무관) — 사용자 명시 확인.
- 리뷰(TravelRecord)는 스탬프와 다대다, 저장코스와 N:1(선택) — "1스탬프=1리뷰" 구조로
  바꾸는 논의가 있었으나 **결론 안 남**(사용자가 질문 중단, 대신 "수동 완료 처리" 기능으로 대체
  요청함 → `PATCH .../complete`로 구현). 스탬프-코스-리뷰 관계를 더 엄격하게 만들 필요가 있으면
  이 부분부터 재검토할 것.
