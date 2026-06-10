import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PlaceDto } from '../../common/dto/place.dto';

/** 축제 응답 — 공통 장소 정보 + 행사 기간/주말 여부 */
export class FestivalDto extends PlaceDto {
  @ApiPropertyOptional({
    description: '행사 시작일 (yyyyMMdd)',
    example: '20260612',
  })
  eventStartDate?: string;

  @ApiPropertyOptional({
    description: '행사 종료일 (yyyyMMdd)',
    example: '20260614',
  })
  eventEndDate?: string;

  @ApiProperty({
    description: '이번 주 금·토·일에 열리는 축제인지 여부 (주말 HOT 판별)',
    example: true,
  })
  isThisWeekend: boolean;
}
