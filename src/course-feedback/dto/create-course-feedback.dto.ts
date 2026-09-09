import { ApiProperty } from '@nestjs/swagger';
import { ArrayMaxSize, ArrayNotEmpty, IsEnum, IsString } from 'class-validator';
import { Zone } from '../../common/gangwon.constants';

export class CreateCourseFeedbackDto {
  @ApiProperty({ description: '피드백 대상 코스의 감성존', enum: Zone })
  @IsEnum(Zone)
  zone: Zone;

  @ApiProperty({
    description:
      '선택한 개선 요청 문구(프리셋 다중 선택). 프론트에서 보여주는 문구를 그대로 전달.',
    type: [String],
    example: ['더 여유로운 코스로', '걷는 시간 줄이기'],
  })
  @ArrayNotEmpty()
  @ArrayMaxSize(10)
  @IsString({ each: true })
  options: string[];
}
