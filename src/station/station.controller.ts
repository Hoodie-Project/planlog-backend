import { Controller, Get, Query } from '@nestjs/common';
import {
  ApiOkResponse,
  ApiOperation,
  ApiProperty,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import {
  GANGWON_BUS_TERMINALS,
  GANGWON_TRAIN_STATIONS,
} from '../common/stations.constants';

export enum StartPointType {
  TRAIN = 'TRAIN',
  BUS = 'BUS',
}

export class StationDto {
  @ApiProperty({ enum: StartPointType, example: StartPointType.TRAIN })
  type: StartPointType;
  @ApiProperty({ example: '강릉역' }) name: string;
  @ApiProperty({ example: '128.8990861', description: '경도(X)' }) mapX: string;
  @ApiProperty({ example: '37.7637611', description: '위도(Y)' }) mapY: string;
}

@ApiTags('출발역/터미널 (Station)')
@Controller('stations')
export class StationController {
  @Get()
  @ApiOperation({
    summary: '강원 기차역·버스터미널 목록',
    description:
      '코스만들기 "여행 시작 장소" 단계의 역/터미널 선택 드롭다운용 고정 목록. 여기의 mapX/mapY 를 POST /courses/generate 의 startMapX/startMapY 로 그대로 전달하면 해당 지점 기준으로 코스가 생성됩니다. type 으로 TRAIN/BUS 필터 가능(생략 시 전체). TourAPI엔 역·터미널이 없어 별도 고정 데이터로 제공 — 버스터미널 좌표는 주소 기준 추정치라 정밀도가 낮습니다.',
  })
  @ApiQuery({ name: 'type', required: false, enum: StartPointType })
  @ApiOkResponse({ type: [StationDto] })
  findAll(@Query('type') type?: StartPointType) {
    const trains = GANGWON_TRAIN_STATIONS.map((s) => ({
      type: StartPointType.TRAIN,
      ...s,
    }));
    const buses = GANGWON_BUS_TERMINALS.map((s) => ({
      type: StartPointType.BUS,
      ...s,
    }));

    if (type === StartPointType.TRAIN) return trains;
    if (type === StartPointType.BUS) return buses;
    return [...trains, ...buses];
  }
}
