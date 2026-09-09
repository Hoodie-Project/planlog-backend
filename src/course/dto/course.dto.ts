import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Style, Transport, Zone } from '../../common/gangwon.constants';

export enum CourseItemType {
  SPOT = 'SPOT', // 관광지
  MEAL = 'MEAL', // 음식점(점심)
  STAY = 'STAY', // 숙소
}

export class CourseItemDto {
  @ApiProperty({ description: '동선 순서(하루 내 1부터)', example: 1 })
  order: number;

  @ApiProperty({ enum: CourseItemType, description: '항목 유형' })
  type: CourseItemType;

  @ApiProperty({ example: '126508' }) contentId: string;
  @ApiProperty({ example: '정동진' }) title: string;

  @ApiPropertyOptional({
    enum: Zone,
    nullable: true,
    description: '이 장소의 추정 감성존 (관광지에 부여, 미분류 시 null)',
  })
  zone?: Zone | null;

  @ApiPropertyOptional() address?: string;
  @ApiPropertyOptional() image?: string;
  @ApiPropertyOptional({ example: '129.0334' }) mapX?: string;
  @ApiPropertyOptional({ example: '37.6907' }) mapY?: string;

  @ApiProperty({ description: '도착 예정 시각 (HH:mm)', example: '10:00' })
  arriveTime: string;

  @ApiProperty({ description: '머무는 시간(분)', example: 90 })
  stayMinutes: number;

  @ApiProperty({ description: '직전 항목에서의 이동 시간(분)', example: 0 })
  travelMinutesFromPrev: number;

  @ApiProperty({ description: '직전 항목과의 거리(m)', example: 0 })
  distanceFromPrev: number;
}

export class CourseDayDto {
  @ApiProperty({ description: '며칠차 (1부터)', example: 1 })
  day: number;

  @ApiProperty({
    description: '이 날 동선 요약',
    example: '1일차 · 속초 아바이마을 4곳',
  })
  summary: string;

  @ApiProperty({ description: '이 날 총 이동 거리(m)', example: 1600 })
  distance: number;

  @ApiProperty({ description: '이 날 총 이동 시간(분)', example: 25 })
  travelMinutes: number;

  @ApiProperty({ type: [CourseItemDto], description: '시간순 동선' })
  items: CourseItemDto[];
}

export class CourseCongestionDto {
  @ApiProperty({ description: '여행 날짜', example: '2026-06-13' })
  date: string;

  @ApiProperty({ description: '해당 요일', example: '토요일' })
  weekday: string;

  @ApiProperty({ description: '혼잡 지수 0~100', example: 100 })
  index: number;

  @ApiProperty({ enum: ['LOW', 'MEDIUM', 'HIGH'], example: 'HIGH' })
  level: string;

  @ApiProperty({
    description: '가장 한산한 추천 요일',
    example: '화요일',
    nullable: true,
  })
  recommendedWeekday: string | null;

  @ApiProperty({
    description: '안내 메시지',
    example: '토요일은 강원 관광객이 가장 많은 날이에요. 화요일이 더 한산해요.',
  })
  message: string;
}

export class RelatedLegDto {
  @ApiProperty({ description: '기준(직전) 관광지', example: '경포해변' })
  fromSpot: string;

  @ApiProperty({
    description: '연관관광지로 매칭되어 다음에 배치된 관광지(없으면 거리 폴백)',
    nullable: true,
    example: '오죽헌',
  })
  matchedRelated: string | null;

  @ApiProperty({
    description: '기준 관광지의 연관 후보 중 풀에 존재해 쓸 수 있던 이름들',
    type: [String],
  })
  available: string[];
}

export class CourseRelatedDebugDto {
  @ApiProperty({ description: '연관관광지 데이터 사용 여부' })
  used: boolean;

  @ApiProperty({ description: '연관 맵의 기준 관광지 수' })
  relatedMapSize: number;

  @ApiProperty({ description: '연관 매칭으로 이어진 구간 수' })
  matchedLegs: number;

  @ApiProperty({ description: '연관 시도 구간 수(첫 스팟 제외)' })
  totalLegs: number;

  @ApiProperty({
    description: '적중률(%) = matchedLegs/totalLegs',
    example: 67,
  })
  hitRate: number;

  @ApiProperty({ type: [RelatedLegDto], description: '구간별 매칭 상세' })
  legs: RelatedLegDto[];
}

export class CourseDto {
  @ApiProperty({ enum: Zone }) zone: Zone;
  @ApiProperty({ description: '감성존 라벨', example: '동해 바다존' })
  zoneLabel: string;
  @ApiProperty({ enum: Transport }) transport: Transport;
  @ApiProperty({ enum: Style }) style: Style;

  @ApiProperty({
    description: '숙박 일수 (0=당일, 1=1박2일, 2=2박3일)',
    example: 1,
  })
  nights: number;

  @ApiProperty({
    description: '코스 요약 한 줄',
    example: '동해 바다존 뚜벅이 1박2일 코스',
  })
  summary: string;

  @ApiProperty({ description: '전체 이동 거리(m)', example: 8200 })
  totalDistance: number;

  @ApiProperty({ description: '전체 이동 시간(분)', example: 95 })
  totalTravelMinutes: number;

  @ApiProperty({
    type: [CourseDayDto],
    description: '일자별 동선 (당일치기는 1개)',
  })
  days: CourseDayDto[];

  @ApiPropertyOptional({
    type: CourseCongestionDto,
    description: 'travelDate 를 준 경우의 혼잡도 안내 (없으면 생략)',
  })
  congestion?: CourseCongestionDto;

  @ApiPropertyOptional({
    type: () => CourseRelatedDebugDto,
    description: 'debug=true 일 때만 — 연관관광지 동선 매칭 진단',
  })
  relatedDebug?: CourseRelatedDebugDto;
}
