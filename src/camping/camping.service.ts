import { Injectable } from '@nestjs/common';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsBooleanString, IsInt, IsOptional, Max, Min } from 'class-validator';
import { TourApiService } from '../tour-api/tour-api.service';

const GOCAMPING_SERVICE = 'GoCamping';

/** GoCamping basedList 원본 아이템(필요 필드 위주) */
interface GoCampingRawItem {
  contentId: string;
  facltNm: string; // 야영장명
  lineIntro?: string; // 한줄소개
  addr1?: string;
  doNm?: string; // 도
  sigunguNm?: string; // 시군구
  induty?: string; // 업종(일반야영장/자동차야영장/글램핑/카라반)
  mapX?: string;
  mapY?: string;
  tel?: string;
  firstImageUrl?: string;
  animalCmgCl?: string; // 반려동물 출입 (가능/불가능)
}

export class CampingQueryDto {
  @ApiPropertyOptional({
    description: '반려동물 동반 가능 캠핑장만',
    default: false,
  })
  @IsOptional()
  @IsBooleanString()
  petOnly?: string;

  @ApiPropertyOptional({ description: '페이지당 개수', default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  numOfRows?: number = 20;

  @ApiPropertyOptional({ description: '페이지 번호', default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  pageNo?: number = 1;
}

export class CampingDto {
  @ApiProperty({ example: '101234' }) contentId: string;
  @ApiProperty({ example: '대관령 글램핑' }) name: string;
  @ApiPropertyOptional() intro?: string;
  @ApiPropertyOptional() address?: string;
  @ApiPropertyOptional({ description: '시군구' }) sigungu?: string;
  @ApiPropertyOptional({ description: '업종(글램핑/카라반 등)' })
  induty?: string;
  @ApiPropertyOptional() mapX?: string;
  @ApiPropertyOptional() mapY?: string;
  @ApiPropertyOptional() tel?: string;
  @ApiPropertyOptional() image?: string;
  @ApiProperty({ description: '반려동물 동반 가능 여부' }) petAllowed: boolean;
}

@Injectable()
export class CampingService {
  constructor(private readonly tourApi: TourApiService) {}

  /** 강원도 고캠핑 캠핑장 조회 (GoCamping basedList → 강원 필터) */
  async findCampings(query: CampingQueryDto): Promise<CampingDto[]> {
    // basedList 는 지역 파라미터가 없어 넉넉히 받아 강원도만 필터링한다.
    const { items } = await this.tourApi.getList<GoCampingRawItem>(
      GOCAMPING_SERVICE,
      'basedList',
      { numOfRows: 4000, pageNo: 1 },
    );

    const petOnly = query.petOnly === 'true';
    let campings = items
      .filter((c) => (c.doNm ?? '').includes('강원'))
      .map((c) => this.toDto(c));

    if (petOnly) {
      campings = campings.filter((c) => c.petAllowed);
    }

    // 간단 페이징
    const start = ((query.pageNo ?? 1) - 1) * (query.numOfRows ?? 20);
    return campings.slice(start, start + (query.numOfRows ?? 20));
  }

  private toDto(c: GoCampingRawItem): CampingDto {
    const pet = (c.animalCmgCl ?? '').trim();
    return {
      contentId: c.contentId,
      name: c.facltNm,
      intro: c.lineIntro || undefined,
      address: c.addr1 || undefined,
      sigungu: c.sigunguNm || undefined,
      induty: c.induty || undefined,
      mapX: c.mapX || undefined,
      mapY: c.mapY || undefined,
      tel: c.tel || undefined,
      image: c.firstImageUrl || undefined,
      petAllowed: pet !== '' && pet !== '불가능',
    };
  }
}
