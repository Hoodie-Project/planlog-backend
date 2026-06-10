import { ApiProperty } from '@nestjs/swagger';
import { AuthProvider } from '../../../generated/prisma/enums.js';

export class AuthUserDto {
  @ApiProperty() id: string;
  @ApiProperty({ enum: AuthProvider }) provider: AuthProvider;
  @ApiProperty() nickname: string;
  @ApiProperty({ required: false, nullable: true }) email: string | null;
  @ApiProperty({ required: false, nullable: true }) profileImage: string | null;
  @ApiProperty() isGuest: boolean;
}

export class AuthResponseDto {
  @ApiProperty({ description: '서비스 JWT 액세스 토큰' })
  accessToken: string;

  @ApiProperty({ type: AuthUserDto })
  user: AuthUserDto;
}
