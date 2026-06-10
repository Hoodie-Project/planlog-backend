import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  const config = new DocumentBuilder()
    .setTitle('PLANLOG API')
    .setDescription(
      'PLANLOG — 강원도 혼행 여행 큐레이션 API. 한국관광공사 TourAPI 기반 관광지·축제·숙소·캠핑 조회.',
    )
    .setVersion('1.0')
    .addTag('인증 (Auth)', '카카오 로그인 + 게스트 계정')
    .addTag('내 코스 (Saved Course)', '코스 저장/조회/삭제 (JWT)')
    .addTag('찜 (Bookmark)', '축제·관광지·코스 찜 + D-Day (JWT)')
    .addTag('감성 스탬프 (Stamp)', '관광지 방문 인증 + 5존 완주 리워드 (JWT)')
    .addTag('동선 매칭 (Match)', '동일 존·날짜 여행 메이트 (JWT)')
    .addTag('코스 (Course)', '무드 셀렉터 → 하루 코스 자동 생성 (핵심)')
    .addTag('관광지 (Spot)', '감성존/위치 기반 관광지 조회')
    .addTag('축제 (Festival)', '주말 HOT 축제')
    .addTag('숙소 (Accommodation)', '혼행 맞춤 숙소 4유형')
    .addTag('캠핑 (Camping)', '강원 고캠핑')
    .addTag('혼잡도 (Congestion)', '강원 요일별 관광 혼잡도 (데이터랩)')
    .addTag('연관 관광지 (Related)', '스팟 간 연관성 (데이터랩)')
    .addTag('반려동물 동반 (Pet)', '반려동물 동반 가능 장소')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api-docs', app, document);

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
