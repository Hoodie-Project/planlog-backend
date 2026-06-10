import { Module } from '@nestjs/common';
import { StampController } from './stamp.controller';
import { StampService } from './stamp.service';

@Module({
  controllers: [StampController],
  providers: [StampService],
})
export class StampModule {}
