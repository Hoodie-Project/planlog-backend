import { Global, Module } from '@nestjs/common';
import { TourApiService } from './tour-api.service';

/**
 * TourAPI 연동 코어 모듈. 전역으로 노출하여 모든 도메인 모듈이
 * 별도 import 없이 TourApiService 를 주입받을 수 있게 한다.
 */
@Global()
@Module({
  providers: [TourApiService],
  exports: [TourApiService],
})
export class TourApiModule {}
