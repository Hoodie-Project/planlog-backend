import { Controller, Get, Query } from '@nestjs/common';
import {
  ApiOkResponse,
  ApiOperation,
  ApiProperty,
  ApiTags,
} from '@nestjs/swagger';
import { CongestionService } from './congestion.service';
import { SpotCongestionQueryDto } from './dto/spot-congestion-query.dto';

class WeekdayCongestionDto {
  @ApiProperty({ example: '6', description: '요일 코드(1=월..7=일)' })
  weekdayCode: string;
  @ApiProperty({ example: '토요일' }) weekday: string;
  @ApiProperty({ example: 100, description: '혼잡 지수 0~100' }) index: number;
  @ApiProperty({ example: 'HIGH', enum: ['LOW', 'MEDIUM', 'HIGH'] })
  level: string;
  @ApiProperty({
    example: 845210,
    description: '요일 평균 관광객 수(외지인+외국인)',
  })
  avgVisitors: number;
}

class CongestionResponseDto {
  @ApiProperty({ type: [WeekdayCongestionDto] })
  weekdays: WeekdayCongestionDto[];
  @ApiProperty({
    type: WeekdayCongestionDto,
    nullable: true,
    description: '가장 한산한 요일(방문 추천)',
  })
  leastBusy: WeekdayCongestionDto | null;
  @ApiProperty({
    type: WeekdayCongestionDto,
    nullable: true,
    description: '가장 붐비는 요일',
  })
  busiest: WeekdayCongestionDto | null;
}

class SpotCongestionDayDto {
  @ApiProperty({ example: '2026-10-05' }) date: string;
  @ApiProperty({ example: 42.3, description: '예측 집중률 0~100' })
  rate: number;
  @ApiProperty({ example: 'MEDIUM', enum: ['LOW', 'MEDIUM', 'HIGH'] })
  level: string;
}

class SpotCongestionForecastDto {
  @ApiProperty({
    description:
      '관광지명 매칭 성공 여부(이 데이터는 contentId가 없어 이름으로만 매칭)',
  })
  matched: boolean;
  @ApiProperty({ example: '강릉향교' }) title: string;
  @ApiProperty({ nullable: true, example: '강릉시' }) sigungu: string | null;
  @ApiProperty({
    type: [SpotCongestionDayDto],
    description:
      '조회일 기준 향후 최대 30일(date 지정 시 해당 일자만), 날짜 오름차순',
  })
  days: SpotCongestionDayDto[];
}

@ApiTags('혼잡도 (Congestion)')
@Controller('congestion')
export class CongestionController {
  constructor(private readonly congestionService: CongestionService) {}

  @Get()
  @ApiOperation({
    summary: '강원 요일별 혼잡도',
    description: [
      '한국관광 데이터랩(DataLabService 방문자 추이)을 기반으로 강원도 요일별 관광 혼잡도를 제공합니다.',
      '',
      '**🔧 가공**: 광역지자체 일별 방문자수에서 **강원(areaCode 51)** 추출 → 현지인 제외(외지인+외국인 관광객만) → **요일별 평균 집계** → 0~100 정규화 + LOW/MEDIUM/HIGH 등급',
      '',
      '**출력**: 요일별 혼잡 지수 + 가장 한산한/붐비는 요일',
    ].join('\n'),
  })
  @ApiOkResponse({ type: CongestionResponseDto })
  async getCongestion(): Promise<CongestionResponseDto> {
    const weekdays = await this.congestionService.getGangwonWeekdayCongestion();
    const leastBusy = this.congestionService.pickLeastBusy(weekdays);
    const busiest =
      weekdays.length > 0
        ? weekdays.reduce((a, b) => (b.index > a.index ? b : a))
        : null;
    return { weekdays, leastBusy, busiest };
  }

  @Get('spot')
  @ApiOperation({
    summary: '관광지(스팟) 단위 집중률 예측',
    description: [
      '한국관광공사 "관광지 집중률 및 방문자 추이 예측 정보"(TatsCnctrRateService) 기반.',
      '조회일 기준 향후 최대 30일의 관광지별 예측 집중률(0~100)을 제공합니다.',
      '',
      '⚠️ 이 데이터는 contentId 가 없고 관광지명(문자열)으로만 제공돼, `title` 파라미터로 이름 매칭합니다',
      '(정확 일치 우선, 없으면 부분일치 폴백). 매칭 실패 시 `matched: false` + 빈 배열 반환(에러 아님).',
      '',
      '**입력**: `zone`(필수), `title`(필수, 관광지명), `date`(선택, YYYY-MM-DD — 생략 시 향후 30일 전체)',
    ].join('\n'),
  })
  @ApiOkResponse({ type: SpotCongestionForecastDto })
  getSpotCongestion(@Query() query: SpotCongestionQueryDto) {
    return this.congestionService.getSpotForecast(
      query.zone,
      query.title,
      query.date,
    );
  }
}
