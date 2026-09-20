import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * JWT가 있고 유효하면 req.user 에 User 주입, 없거나 유효하지 않아도 요청을 막지 않음.
 * 비로그인 사용자도 접근 가능하되, 로그인 시에만 개인화 정보(예: 스탬프 여부)를 덧붙이는 라우트에 사용.
 */
@Injectable()
export class OptionalJwtAuthGuard extends AuthGuard('jwt') {
  handleRequest<TUser = unknown>(_err: unknown, user: unknown): TUser {
    return (user || null) as TUser;
  }
}
