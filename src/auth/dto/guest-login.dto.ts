import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class GuestLoginDto {
  @ApiProperty({ description: '게스트 아이디(고정값)', example: 'guest' })
  @IsString()
  @IsNotEmpty()
  guestId: string;

  @ApiProperty({
    description: '게스트 비밀번호(고정값)',
    example: '2026guest!',
  })
  @IsString()
  @IsNotEmpty()
  password: string;
}
