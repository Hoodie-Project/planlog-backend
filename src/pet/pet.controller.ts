import { Controller, Get, Param, Query } from '@nestjs/common';
import {
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { PetService } from './pet.service';
import { PetQueryDto } from './dto/pet-query.dto';
import { PlaceDto } from '../common/dto/place.dto';

@ApiTags('반려동물 동반 (Pet)')
@Controller('pet-spots')
export class PetController {
  constructor(private readonly petService: PetService) {}

  @Get()
  @ApiOperation({
    summary: '반려동물 동반 가능 장소 조회',
    description: [
      '한국관광공사 반려동물 동반여행 서비스(KorPetTourService)에서 강원 반려동물 동반 가능 장소를 제공합니다.',
      '',
      '**입력**: `zone`(감성존), `contentTypeId`(12 관광지/39 음식점/32 숙박), `numOfRows`, `pageNo`',
      '',
      '**🔧 가공**: 시군구 병렬 조회·중복 제거 후 PlaceDto 정규화(여기 나오는 곳은 모두 반려동물 동반 가능)',
    ].join('\n'),
  })
  @ApiOkResponse({ type: [PlaceDto] })
  findPetSpots(@Query() query: PetQueryDto) {
    return this.petService.findPetSpots(query);
  }

  @Get(':contentId/info')
  @ApiOperation({
    summary: '관광지 반려동물 동반 조건 상세',
    description:
      'detailPetTour2 — 특정 관광지의 반려동물 동반 유형·동반 가능 시설·유의사항 등 상세 정보.',
  })
  @ApiParam({ name: 'contentId', description: 'TourAPI 콘텐츠 ID' })
  getPetInfo(@Param('contentId') contentId: string) {
    return this.petService.getPetInfo(contentId);
  }
}
