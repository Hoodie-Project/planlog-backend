import { ApiProperty } from '@nestjs/swagger';

export class MeStatsDto {
  @ApiProperty({ description: '저장한 코스 개수', example: 4 })
  savedCoursesCount: number;

  @ApiProperty({ description: '찜 개수', example: 7 })
  bookmarksCount: number;

  @ApiProperty({ description: '보유 스탬프(방문 인증) 개수', example: 12 })
  stampsCount: number;

  @ApiProperty({ description: '완주한 감성존 개수', example: 2 })
  collectedZoneCount: number;

  @ApiProperty({ description: '전체 감성존 개수', example: 5 })
  totalZoneCount: number;

  @ApiProperty({ description: '작성한 기록 카드 개수', example: 7 })
  recordsCount: number;
}
