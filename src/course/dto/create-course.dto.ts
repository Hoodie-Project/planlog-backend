import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsNumberString,
  IsOptional,
  Matches,
  Max,
  Min,
} from 'class-validator';
import { Style, Transport, Zone } from '../../common/gangwon.constants';

/** 무드 셀렉터 입력 → 하루 코스 자동 생성 요청 */
export class CreateCourseDto {
  @ApiProperty({ description: '감성존', enum: Zone, example: Zone.SEA })
  @IsEnum(Zone)
  zone: Zone;

  @ApiPropertyOptional({
    description: '이동 수단 (뚜벅이/KTX/렌터카)',
    enum: Transport,
    default: Transport.WALK,
  })
  @IsOptional()
  @IsEnum(Transport)
  transport?: Transport = Transport.WALK;

  @ApiPropertyOptional({
    description: '여행 스타일 (혼자/반려동물)',
    enum: Style,
    default: Style.SOLO,
  })
  @IsOptional()
  @IsEnum(Style)
  style?: Style = Style.SOLO;

  @ApiPropertyOptional({
    description: '하루당 관광지 개수 (점심·숙소는 별도로 추가됨)',
    default: 3,
    minimum: 2,
    maximum: 5,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(2)
  @Max(5)
  spotCount?: number = 3;

  @ApiPropertyOptional({
    description: '숙박 일정 — 0=당일치기, 1=1박2일, 2=2박3일',
    default: 0,
    minimum: 0,
    maximum: 2,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(2)
  nights?: number = 0;

  @ApiPropertyOptional({
    description:
      '랜덤 시드(선택). 생략하면 호출할 때마다 코스가 달라집니다. 같은 값을 주면 동일한 코스가 재현됩니다.',
    example: 42,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  seed?: number;

  @ApiPropertyOptional({
    description:
      '여행 날짜(YYYY-MM-DD, 선택). 주면 해당 요일의 강원 혼잡도와 한산한 요일 추천을 코스에 함께 제공합니다.',
    example: '2026-06-13',
  })
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'travelDate 는 YYYY-MM-DD 형식이어야 합니다.' })
  travelDate?: string;

  @ApiPropertyOptional({
    description:
      'true 면 응답에 연관관광지 매칭 진단(relatedDebug: 어떤 연관 스팟이 매칭/미매칭됐는지, 적중률)을 포함',
    default: false,
  })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  debug?: boolean;

  @ApiPropertyOptional({
    description: '출발 좌표 경도(X). 뚜벅이 KTX역 출발 등. 생략 시 후보 중심에서 시작',
    example: '128.8961',
  })
  @IsOptional()
  @IsNumberString()
  startMapX?: string;

  @ApiPropertyOptional({ description: '출발 좌표 위도(Y)', example: '37.7649' })
  @IsOptional()
  @IsNumberString()
  startMapY?: string;
}
