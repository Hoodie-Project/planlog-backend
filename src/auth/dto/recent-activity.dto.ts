import { ApiProperty } from '@nestjs/swagger';

export enum RecentActivityType {
  SAVED_COURSE = 'SAVED_COURSE',
  STAMP = 'STAMP',
}

export class RecentActivityDto {
  @ApiProperty({ enum: RecentActivityType })
  type: RecentActivityType;

  @ApiProperty({ description: '표시용 제목', example: '주문진 등대 스탬프 획득' })
  title: string;

  @ApiProperty({ description: '발생 시각' })
  occurredAt: Date;
}
