import { Module } from '@nestjs/common';
import { CourseFeedbackController } from './course-feedback.controller';
import { CourseFeedbackService } from './course-feedback.service';

@Module({
  controllers: [CourseFeedbackController],
  providers: [CourseFeedbackService],
})
export class CourseFeedbackModule {}
