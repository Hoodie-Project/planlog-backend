import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/** 라우트에 붙이면 유효한 JWT 가 필요. req.user 에 User 주입 */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {}
