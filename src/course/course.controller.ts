import { Body, Controller, Post } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CourseService } from './course.service';
import { CreateCourseDto } from './dto/create-course.dto';
import { CourseDto } from './dto/course.dto';

@ApiTags('코스 (Course)')
@Controller('courses')
export class CourseController {
  constructor(private readonly courseService: CourseService) {}

  @Post('generate')
  @ApiOperation({
    summary: '무드 셀렉터 → 코스 자동 생성 ⭐ (PLANLOG 핵심)',
    description: [
      '감성존·이동수단·박수만 고르면 **관광지 + 점심 + 숙소**를 묶어 시간표가 있는 완성형 코스를 자동 설계합니다.',
      '관광 데이터는 모두 한국관광공사 TourAPI 실시간 호출이며, 결과는 **호출할 때마다 달라집니다**(가중 랜덤).',
      '',
      '### 생성 로직 (파이프라인)',
      '1. **재료 수집** — 감성존 시군구에서 관광지·음식점·숙소를 TourAPI 병렬 조회 → 좌표 있는 것만 후보화, 감성 키워드·이미지로 점수 부여',
      '2. **연관 데이터 로드** — 연관관광지(데이터랩)로 "함께 가는 스팟" 맵 구성 → 연관에 자주 등장하는 인기 스팟에 점수 가산',
      '3. **일자별 동선 구성** (박수+1일 반복)',
      '   - 출발점: 1일차는 출발좌표(있으면) 또는 **가장 밀집한 클러스터**, 이후엔 매일 새 지역 탐색',
      '   - 다음 스팟: ① 직전 스팟의 **연관관광지가 반경 내 풀에 있으면 그쪽으로 연결** ② 없으면 가까운 곳 상위 3 중 가중 랜덤(폴백)',
      '   - 점심(동선 중간 음식점) + 숙소(마지막 스팟 근처, 마지막 날 제외) 삽입',
      '4. **시간표 배치** — 10:00 시작, 구간마다 (거리÷이동속도) 이동시간 + 체류시간 누적, 13시 이후 점심 자동 삽입',
      '5. **부가 정보** — `travelDate` 주면 그 요일 혼잡도+한산요일 추천, `debug` 주면 연관 매칭 적중률 진단',
      '',
      '### 규칙값',
      '| 항목 | 값 |',
      '|---|---|',
      '| 한 구간 최대 이동거리 | 뚜벅이 2.5km / KTX 6km / 렌터카 30km |',
      '| 이동 속도 | 도보 4 / KTX 30 / 렌터카 40 (km/h) |',
      '| 체류 시간 | 관광지 90분 · 점심 60분 |',
      '',
      '### 요청 본문(JSON)',
      '- `zone`(필수): SEA(동해바다)/SNOW(설원산악)/VALLEY(계곡자연)/RETRO(레트로문화)/PHOTO(절경포토)',
      '- `transport`: WALK(뚜벅이·기본)/KTX/CAR(렌터카) — 동선 반경이 달라짐',
      '- `style`: SOLO(기본)/PET(반려동물 — 펜션·캠핑 가중)',
      '- `spotCount`: 하루당 관광지 수(2~5, 기본 3)',
      '- `nights`: 0=당일/1=1박2일/2=2박3일 (기본 0)',
      '- `travelDate`(선택, YYYY-MM-DD): 혼잡도 안내 추가',
      '- `startMapX`/`startMapY`(선택): 1일차 출발 좌표(예: KTX역)',
      '- `seed`(선택): 고정 시 동일 코스 재현, 생략 시 매번 변주',
      '- `debug`(선택): 연관관광지 매칭 적중률 진단 포함',
      '',
      '### 응답(CourseDto)',
      '감성존·이동수단·`nights`·요약·총거리/총이동시간 + `days[]`(일자별 요약·거리·시간 + `items` 시간순 동선[관광지/점심/숙소]) + `congestion?`(travelDate 시) + `relatedDebug?`(debug 시)',
    ].join('\n'),
  })
  @ApiOkResponse({ type: CourseDto })
  generate(@Body() dto: CreateCourseDto) {
    return this.courseService.generate(dto);
  }
}
