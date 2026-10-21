import { Injectable } from '@nestjs/common';
import { SUBJECT_MAP, type KnowledgeStat, type OverviewStats } from '@myos/shared';
import { PrismaService } from '../common/prisma/prisma.service';
import {
  daysAgoStart,
  formatDate,
  lastNDates,
  startOfWeek,
} from '../common/utils/date.util';
import { StudentsService } from '../students/students.service';
import { KnowledgeStatsQueryDto, OverviewQueryDto } from './dto/stats.dto';

@Injectable()
export class StatsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly students: StudentsService,
  ) {}

  async overview(userId: string, query: OverviewQueryDto): Promise<OverviewStats> {
    const student = await this.students.resolveStudent(userId, query.studentId);
    const days = query.days ?? 30;
    const questions = await this.prisma.wrongQuestion.findMany({
      where: { userId, studentId: student.id, deletedAt: null },
      select: {
        subjectId: true,
        mastery: true,
        status: true,
        createdAt: true,
      },
    });

    const now = new Date();
    const weekStart = startOfWeek();

    const active = questions.filter((question) => question.status === 'ACTIVE');
    const subjectCounts = new Map<string, number>();
    const masteryCounts = new Map<number, number>();
    const trendCounts = new Map<string, number>();

    for (const question of active) {
      subjectCounts.set(question.subjectId, (subjectCounts.get(question.subjectId) ?? 0) + 1);
      masteryCounts.set(question.mastery, (masteryCounts.get(question.mastery) ?? 0) + 1);
      const date = formatDate(question.createdAt);
      trendCounts.set(date, (trendCounts.get(date) ?? 0) + 1);
    }

    return {
      totalQuestions: questions.length,
      activeQuestions: active.length,
      masteredQuestions: active.filter((question) => question.mastery >= 5).length,
      addedThisWeek: active.filter((question) => question.createdAt >= weekStart).length,
      addedLast7Days: active.filter(
        (question) => question.createdAt >= daysAgoStart(6) && question.createdAt <= now,
      ).length,
      subjectDistribution: Array.from(subjectCounts.entries())
        .map(([subjectId, count]) => ({
          subjectId,
          name: SUBJECT_MAP[subjectId]?.name ?? subjectId,
          color: SUBJECT_MAP[subjectId]?.color ?? '#64748b',
          count,
        }))
        .sort((a, b) => b.count - a.count),
      masteryDistribution: Array.from({ length: 6 }, (_, mastery) => ({
        mastery,
        count: masteryCounts.get(mastery) ?? 0,
      })),
      trend: lastNDates(days).map((date) => ({
        date,
        count: trendCounts.get(date) ?? 0,
      })),
    };
  }

  async knowledge(userId: string, query: KnowledgeStatsQueryDto): Promise<KnowledgeStat[]> {
    const student = await this.students.resolveStudent(userId, query.studentId);
    const links = await this.prisma.wrongQuestionKnowledgePoint.findMany({
      where: {
        wrongQuestion: {
          userId,
          studentId: student.id,
          deletedAt: null,
          status: 'ACTIVE',
        },
        ...(query.subjectId ? { knowledgePoint: { subjectId: query.subjectId } } : {}),
      },
      include: {
        knowledgePoint: true,
        wrongQuestion: {
          select: { mastery: true, createdAt: true },
        },
      },
    });

    const grouped = new Map<
      string,
      {
        name: string;
        subjectId: string;
        count: number;
        masterySum: number;
        lastWrongAt: Date | null;
      }
    >();

    for (const link of links) {
      const current = grouped.get(link.knowledgePointId) ?? {
        name: link.knowledgePoint.name,
        subjectId: link.knowledgePoint.subjectId,
        count: 0,
        masterySum: 0,
        lastWrongAt: null,
      };
      current.count += 1;
      current.masterySum += link.wrongQuestion.mastery;
      if (!current.lastWrongAt || link.wrongQuestion.createdAt > current.lastWrongAt) {
        current.lastWrongAt = link.wrongQuestion.createdAt;
      }
      grouped.set(link.knowledgePointId, current);
    }

    return Array.from(grouped.entries())
      .map(([knowledgePointId, item]) => {
        const avgMastery = item.count ? item.masterySum / item.count : 0;
        return {
          knowledgePointId,
          name: item.name,
          subjectId: item.subjectId,
          count: item.count,
          avgMastery,
          lastWrongAt: item.lastWrongAt?.toISOString() ?? null,
          weakScore: item.count * 0.5 + (5 - avgMastery) * 2,
        };
      })
      .sort((a, b) => b.weakScore - a.weakScore)
      .slice(0, query.limit ?? 10);
  }
}
