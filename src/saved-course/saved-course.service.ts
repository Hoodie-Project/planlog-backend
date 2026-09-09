import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '../../generated/prisma/client.js';
import { CreateSavedCourseDto } from './dto/create-saved-course.dto';

@Injectable()
export class SavedCourseService {
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: string, dto: CreateSavedCourseDto) {
    const course = dto.course;
    return this.prisma.savedCourse.create({
      data: {
        userId,
        title: dto.title ?? course.summary ?? '내 코스',
        zone: course.zone,
        nights: course.nights ?? 0,
        // 클래스 인스턴스(CourseDto)를 Prisma Json 필드가 요구하는 순수 JSON 값으로 변환
        payload: JSON.parse(JSON.stringify(course)) as Prisma.InputJsonValue,
      },
    });
  }

  findAll(userId: string) {
    return this.prisma.savedCourse.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(userId: string, id: string) {
    const course = await this.prisma.savedCourse.findFirst({
      where: { id, userId },
    });
    if (!course) throw new NotFoundException('저장된 코스를 찾을 수 없습니다.');
    return course;
  }

  async remove(userId: string, id: string) {
    await this.findOne(userId, id); // 소유권 확인
    await this.prisma.savedCourse.delete({ where: { id } });
    return { deleted: true, id };
  }
}
