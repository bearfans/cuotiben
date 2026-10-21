import { Injectable } from '@nestjs/common';
import { gradeStage, type Stage, type Subject } from '@myos/shared';
import type { Subject as SubjectModel } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';

@Injectable()
export class SubjectsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(grade?: number): Promise<Subject[]> {
    const stage = grade ? gradeStage(grade) : undefined;
    const subjects = await this.prisma.subject.findMany({ orderBy: { sortOrder: 'asc' } });
    return subjects
      .filter((subject) => !stage || subject.stages.includes(stage))
      .map((subject) => this.toDto(subject));
  }

  async getById(id: string): Promise<Subject | null> {
    const subject = await this.prisma.subject.findUnique({ where: { id } });
    return subject ? this.toDto(subject) : null;
  }

  private toDto(subject: SubjectModel): Subject {
    return {
      id: subject.id,
      name: subject.name,
      shortName: subject.shortName,
      stages: subject.stages as Stage[],
      color: subject.color,
      sortOrder: subject.sortOrder,
    };
  }
}
