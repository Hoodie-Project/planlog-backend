import { Module } from '@nestjs/common';
import { RelatedController } from './related.controller';
import { RelatedService } from './related.service';

@Module({
  controllers: [RelatedController],
  providers: [RelatedService],
  exports: [RelatedService],
})
export class RelatedModule {}
