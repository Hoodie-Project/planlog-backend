import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class KakaoLoginDto {
  @ApiProperty({
    description: '카카오 로그인 SDK로 발급받은 액세스 토큰',
    example: 'kakao_access_token_xxx',
  })
  @IsString()
  @IsNotEmpty()
  accessToken: string;
}
