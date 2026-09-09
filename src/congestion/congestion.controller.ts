import { Controller, Get } from '@nestjs/common';
import {
  ApiOkResponse,
  ApiOperation,
  ApiProperty,
  ApiTags,
} from '@nestjs/swagger';
import { CongestionService } from './congestion.service';

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
}
