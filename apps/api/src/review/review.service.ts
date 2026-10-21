import { Injectable, NotFoundException } from '@nestjs/common';
import { addDaysToInterval, type ReviewHistoryItem, type ReviewToday } from '@myos/shared';
import { PrismaService } from '../common/prisma/prisma.service';
import {
  endOfToday,
  formatDate,
  monthRange,
  nextReviewDate,
  startOfToday,
} from '../common/utils/date.util';
import { StudentsService } from '../students/students.service';
import { WrongQuestionsService } from '../wrong-questions/wrong-questions.service';
import {
  ReviewCalendarQueryDto,
  ReviewHistoryQueryDto,
  SnoozeReviewDto,
} from './dto/review.dto';
import { CompleteReviewDto } from './dto/review.dto';

@Injectable()
export class ReviewService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly students: StudentsService,
    private readonly wrongQuestions: WrongQuestionsService,
  ) {}

  async today(userId: string, studentId?: string): Promise<ReviewToday> {
    const student = await this.students.resolveStudent(userId, studentId);
    const start = startOfToday();
    const end = endOfToday();
    const due = await this.wrongQuestions.findDue(userId, student.id, end);
    const completedToday = await this.prisma.reviewLog.count({
      where: {
        userId,
        wrongQuestion: { studentId: student.id },
        completedAt: { gte: start, lte: end },
      },
    });
    const overdue = due
      .filter((question) => new Date(question.nextReviewAt).getTime() < start.getTime())
      .map((question) => ({ ...question, overdue: true }));
    const today = due
      .filter((question) => new Date(question.nextReviewAt).getTime() >= start.getTime())
      .map((question) => ({ ...question, overdue: false }));
    return {
      today,
      overdue,
      completedToday,
      totalDue: today.length + overdue.length,
    };
  }

  async complete(userId: string, id: string, dto: CompleteReviewDto) {
    const question = await this.wrongQuestions.findOwned(userId, id);
    const intervalBefore = question.intervalDays;
    const masteryBefore = question.mastery;
    const intervalAfter = addDaysToInterval(dto.rating, intervalBefore);
    const delta =
      dto.rating === 'AGAIN' ? -2 : dto.rating === 'HARD' ? -1 : dto.rating === 'EASY' ? 2 : 1;
    const masteryAfter = Math.max(0, Math.min(5, masteryBefore + delta));
    const scheduledAt = question.nextReviewAt;

    await this.prisma.$transaction([
      this.prisma.wrongQuestion.update({
        where: { id },
        data: {
          intervalDays: intervalAfter,
          mastery: masteryAfter,
          reviewCount: { increment: 1 },
          lastReviewedAt: new Date(),
          nextReviewAt: nextReviewDate(intervalAfter),
        },
      }),
      this.prisma.reviewLog.create({
        data: {
          userId,
          wrongQuestionId: id,
          rating: dto.rating,
          scheduledAt,
          intervalBefore,
          intervalAfter,
          masteryBefore,
          masteryAfter,
        },
      }),
    ]);

    return this.wrongQuestions.get(userId, id);
  }

  async snooze(userId: string, id: string, dto: SnoozeReviewDto) {
    await this.wrongQuestions.findOwned(userId, id);
    await this.prisma.wrongQuestion.update({
      where: { id },
      data: { nextReviewAt: nextReviewDate(dto.days ?? 1) },
    });
    return this.wrongQuestions.get(userId, id);
  }

  async calendar(userId: string, query: ReviewCalendarQueryDto) {
    const student = await this.students.resolveStudent(userId, query.studentId);
    const { start, end, days } = monthRange(query.month);
    const questions = await this.prisma.wrongQuestion.findMany({
      where: {
        userId,
        studentId: student.id,
        deletedAt: null,
        status: 'ACTIVE',
        nextReviewAt: { gte: start, lte: end },
      },
      select: { nextReviewAt: true },
    });
    const logs = await this.prisma.reviewLog.findMany({
      where: {
        userId,
        wrongQuestion: { studentId: student.id },
        completedAt: { gte: start, lte: end },
      },
      select: { completedAt: true },
    });

    const dueMap = new Map<string, number>();
    for (const question of questions) {
      const date = formatDate(question.nextReviewAt);
      dueMap.set(date, (dueMap.get(date) ?? 0) + 1);
    }
    const completedMap = new Map<string, number>();
    for (const log of logs) {
      const date = formatDate(log.completedAt);
      completedMap.set(date, (completedMap.get(date) ?? 0) + 1);
    }

    return {
      month: query.month,
      days,
      due: Array.from(dueMap.entries()).map(([date, count]) => ({ date, count })),
      completed: Array.from(completedMap.entries()).map(([date, count]) => ({ date, count })),
    };
  }

  async history(userId: string, query: ReviewHistoryQueryDto) {
    const student = await this.students.resolveStudent(userId, query.studentId);
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const where = {
      userId,
      wrongQuestion: { studentId: student.id },
    };
    const [total, logs] = await this.prisma.$transaction([
      this.prisma.reviewLog.count({ where }),
      this.prisma.reviewLog.findMany({
        where,
        include: {
          wrongQuestion: {
            include: { subject: true },
          },
        },
        orderBy: { completedAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    const items: ReviewHistoryItem[] = logs.map((log) => ({
      id: log.id,
      rating: log.rating,
      scheduledAt: log.scheduledAt.toISOString(),
      completedAt: log.completedAt.toISOString(),
      intervalBefore: log.intervalBefore,
      intervalAfter: log.intervalAfter,
      masteryBefore: log.masteryBefore,
      masteryAfter: log.masteryAfter,
      wrongQuestion: {
        id: log.wrongQuestion.id,
        stem: log.wrongQuestion.stem,
        subjectId: log.wrongQuestion.subjectId,
        subjectName: log.wrongQuestion.subject.name,
        grade: log.wrongQuestion.grade,
      },
    }));

    return { items, total, page, pageSize };
  }
}
