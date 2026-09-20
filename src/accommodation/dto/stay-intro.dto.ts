import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/** 숙소 상세 이용정보 (TourAPI detailIntro2, contentTypeId=32) */
export class StayIntroDto {
  @ApiPropertyOptional({ description: '체크인 시각' })
  checkInTime?: string;

  @ApiPropertyOptional({ description: '체크아웃 시각' })
  checkOutTime?: string;

  @ApiPropertyOptional({ description: '객실 수' })
  roomCount?: string;

  @ApiPropertyOptional({ description: '취사 가능 여부' })
  cooking?: string;

  @ApiPropertyOptional({ description: '주차 가능 여부' })
  parking?: string;

  @ApiPropertyOptional({ description: '문의처(전화번호)' })
  infoCenter?: string;

  @ApiPropertyOptional({ description: '예약 안내 URL' })
  reservationUrl?: string;

  @ApiPropertyOptional({ description: '부대시설(기타 서술)' })
  subFacility?: string;

  @ApiProperty({
    type: [String],
    description: '보유 부대시설 목록(바베큐/사우나/헬스장 등 있는 것만)',
  })
  amenities: string[];
}
