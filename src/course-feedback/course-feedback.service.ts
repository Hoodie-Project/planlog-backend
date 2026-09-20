import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCourseFeedbackDto } from './dto/create-course-feedback.dto';

@Injectable()
export class CourseFeedbackService {
  constructor(private readonly prisma: PrismaService) {}

  create(userId: string, dto: CreateCourseFeedbackDto) {
    return this.prisma.courseFeedback.create({
      data: {
        userId,
        zone: dto.zone,
        options: dto.options,
      },
    });
  }

  findAll(userId: string) {
    return this.prisma.courseFeedback.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }
}
