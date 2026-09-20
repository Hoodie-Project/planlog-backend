import { ApiPropertyOptional } from '@nestjs/swagger';

/** 관광지 상세 이용정보 (TourAPI detailIntro2) */
export class SpotIntroDto {
  @ApiPropertyOptional({ description: '문의처(전화번호)' })
  infoCenter?: string;

  @ApiPropertyOptional({ description: '개장일' })
  openDate?: string;

  @ApiPropertyOptional({ description: '쉬는날' })
  restDate?: string;

  @ApiPropertyOptional({ description: '이용시간' })
  useTime?: string;

  @ApiPropertyOptional({ description: '이용시기(계절)' })
  useSeason?: string;

  @ApiPropertyOptional({ description: '주차 시설' })
  parking?: string;

  @ApiPropertyOptional({ description: '유모차 대여 가능 여부' })
  babyCarriage?: string;

  @ApiPropertyOptional({ description: '반려동물 동반 가능 여부' })
  petAllowed?: string;

  @ApiPropertyOptional({ description: '신용카드 사용 가능 여부' })
  creditCard?: string;
}
