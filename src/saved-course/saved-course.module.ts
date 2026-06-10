import { Module } from '@nestjs/common';
import { SavedCourseController } from './saved-course.controller';
import { SavedCourseService } from './saved-course.service';

@Module({
  controllers: [SavedCourseController],
  providers: [SavedCourseService],
})
export class SavedCourseModule {}
