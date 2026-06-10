import { Controller, Get } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';

@ApiExcludeController() // 헬스체크 전용 — 프론트 미사용, Swagger 문서에서 숨김
@Controller()
export class AppController {
  @Get('health')
  health() {
    return { status: 'ok', service: 'planlog-backend' };
  }
}
