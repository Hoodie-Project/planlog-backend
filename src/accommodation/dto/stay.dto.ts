import { ApiProperty } from '@nestjs/swagger';
import { PlaceDto } from '../../common/dto/place.dto';
import { StayType } from './accommodation-query.dto';

/** 숙소 응답 — 공통 장소 정보 + 혼행 적합 유형 */
export class StayDto extends PlaceDto {
  @ApiProperty({
    description:
      '혼행 적합도 4유형 — VALUE(가성비) / SOCIAL(교류형·게스트하우스) / HEALING(감성힐링·펜션) / CAMPING(캠핑·글램핑)',
    enum: StayType,
    example: StayType.HEALING,
  })
  stayType: StayType;
}
