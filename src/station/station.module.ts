import { Module } from '@nestjs/common';
import { StationController } from './station.controller';

@Module({
  controllers: [StationController],
})
export class StationModule {}
