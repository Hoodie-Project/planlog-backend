import { Module } from '@nestjs/common';
import { CampingController } from './camping.controller';
import { CampingService } from './camping.service';

@Module({
  controllers: [CampingController],
  providers: [CampingService],
  exports: [CampingService],
})
export class CampingModule {}
