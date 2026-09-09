import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Zone } from '../gangwon.constants';
import { TourRawItem } from '../../tour-api/tour-api.types';
import { inferZone } from '../gangwon.constants';

/**
 * TourAPI 아이템을 프론트가 그대로 쓸 수 있게 정규화한 공통 장소 모델.
 * (관광지/축제/숙소가 공유)
 */
export class PlaceDto {
  @ApiProperty({ description: 'TourAPI 콘텐츠 ID', example: '126508' })
  contentId: string;

  @ApiProperty({ description: '콘텐츠 타입 ID', example: '12' })
  contentTypeId: string;

  @ApiProperty({ description: '명칭', example: '정동진' })
  title: string;

  @ApiPropertyOptional({
    description: '주소',
    example: '강원특별자치도 강릉시 강동면',
  })
  address?: string;

  @ApiPropertyOptional({ description: '시군구 코드', example: '1' })
  sigunguCode?: string;

  @ApiPropertyOptional({ description: '경도(X)', example: '129.0334' })
  mapX?: string;

  @ApiPropertyOptional({ description: '위도(Y)', example: '37.6907' })
  mapY?: string;

  @ApiPropertyOptional({ description: '대표 이미지 URL' })
  image?: string;

  @ApiPropertyOptional({ description: '전화번호' })
  tel?: string;

  @ApiPropertyOptional({
    description: '추정 감성존 (키워드/시군구 기반 자동 분류)',
    enum: Zone,
    nullable: true,
  })
  zone?: Zone | null;

  @ApiPropertyOptional({
    description: '기준 좌표로부터의 거리(m). 위치기반 조회 시에만 존재',
    example: '1532',
  })
  dist?: string;
}

/** TourAPI 원본 아이템 → PlaceDto 정규화 */
export function toPlaceDto(raw: TourRawItem): PlaceDto {
  return {
    contentId: raw.contentid,
    contentTypeId: raw.contenttypeid,
    title: raw.title,
    address: [raw.addr1, raw.addr2].filter(Boolean).join(' ') || undefined,
    sigunguCode: raw.sigungucode,
    mapX: raw.mapx,
    mapY: raw.mapy,
    image: raw.firstimage || raw.firstimage2 || undefined,
    tel: raw.tel,
    zone: inferZone(raw.title, raw.sigungucode),
    dist: raw.dist,
  };
}
