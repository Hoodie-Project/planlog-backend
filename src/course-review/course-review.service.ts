import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Mood } from '../common/mood.constants';
import {
  CourseReviewItemDto,
  CourseReviewMoodCountDto,
  CourseReviewSummaryDto,
} from './dto/course-review.dto';

@Injectable()
export class CourseReviewService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * 코스에 포함된 관광지(contentIds)에 대해, 감정(mood)까지 남긴 스탬프 후기를
   * 전체 유저 기준으로 모아 반환한다("코스 후기" — 실체는 스탬프 후기 모음).
   * 노트만 있고 mood 가 없는 리뷰는 "분위기 집계"에 쓸 수 없어 제외한다.
   */
  async getCourseReviews(
    contentIdsCsv: string,
  ): Promise<CourseReviewSummaryDto> {
    const contentIds = this.parseContentIds(contentIdsCsv);
    if (contentIds.length === 0) {
      return { totalCount: 0, topMoods: [], reviews: [] };
    }

    const stamps = await this.prisma.stamp.findMany({
      where: { contentId: { in: contentIds } },
      orderBy: { visitedAt: 'desc' },
      include: {
        travelRecords: {
          where: { mood: { not: null } },
          select: { note: true, mood: true },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });

    const reviews: CourseReviewItemDto[] = [];
    const moodCounts = new Map<string, number>();

    for (const stamp of stamps) {
      const record = stamp.travelRecords[0];
      if (!record?.mood) continue;

      reviews.push({
        contentId: stamp.contentId,
        title: stamp.title,
        visitedAt: stamp.visitedAt,
        note: record.note,
        mood: record.mood as Mood,
      });
      moodCounts.set(record.mood, (moodCounts.get(record.mood) ?? 0) + 1);
    }

    const topMoods: CourseReviewMoodCountDto[] = Array.from(
      moodCounts.entries(),
    )
      .map(([mood, count]) => ({ mood: mood as Mood, count }))
      .sort((a, b) => b.count - a.count);

    return { totalCount: reviews.length, topMoods, reviews };
  }

  private parseContentIds(csv: string): string[] {
    return Array.from(
      new Set(
        csv
          .split(',')
          .map((id) => id.trim())
          .filter(Boolean),
      ),
    );
  }
}
