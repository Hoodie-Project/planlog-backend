import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { PrismaModule } from './prisma/prisma.module';
import { TourApiModule } from './tour-api/tour-api.module';
import { SpotModule } from './spot/spot.module';
import { FestivalModule } from './festival/festival.module';
import { AccommodationModule } from './accommodation/accommodation.module';
import { CampingModule } from './camping/camping.module';
import { CourseModule } from './course/course.module';
import { CongestionModule } from './congestion/congestion.module';
import { AuthModule } from './auth/auth.module';
import { SavedCourseModule } from './saved-course/saved-course.module';
import { BookmarkModule } from './bookmark/bookmark.module';
import { StampModule } from './stamp/stamp.module';
import { MatchModule } from './match/match.module';
import { RelatedModule } from './related/related.module';
import { PetModule } from './pet/pet.module';
import { NotificationSettingsModule } from './notification-settings/notification-settings.module';
import { CourseFeedbackModule } from './course-feedback/course-feedback.module';
import { RecordModule } from './record/record.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    TourApiModule,
    SpotModule,
    FestivalModule,
    AccommodationModule,
    CampingModule,
    CourseModule,
    CongestionModule,
    AuthModule,
    SavedCourseModule,
    BookmarkModule,
    StampModule,
    MatchModule,
    RelatedModule,
    PetModule,
    NotificationSettingsModule,
    CourseFeedbackModule,
    RecordModule,
  ],
  controllers: [AppController],
})
export class AppModule {}
