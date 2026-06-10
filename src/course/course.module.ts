import { Module } from '@nestjs/common';
import { CourseController } from './course.controller';
import { CourseService } from './course.service';
import { CongestionModule } from '../congestion/congestion.module';
import { RelatedModule } from '../related/related.module';
import { PetModule } from '../pet/pet.module';

@Module({
  imports: [CongestionModule, RelatedModule, PetModule],
  controllers: [CourseController],
  providers: [CourseService],
  exports: [CourseService],
})
export class CourseModule {}
