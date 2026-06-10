import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { User } from '../../generated/prisma/client.js';

/** 컨트롤러 핸들러에서 현재 로그인 User 를 주입 (@CurrentUser() user: User) */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): User => {
    const request = ctx.switchToHttp().getRequest();
    return request.user as User;
  },
);
