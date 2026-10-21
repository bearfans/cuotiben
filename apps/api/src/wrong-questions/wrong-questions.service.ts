import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, type QuestionStatus } from '@prisma/client';
import type {
  KnowledgePoint as KnowledgePointDto,
  QuestionOption,
  Subject as SubjectDto,
  WrongQuestion,
} from '@myos/shared';
import { PrismaService } from '../common/prisma/prisma.service';
import { endOfDay } from '../common/utils/date.util';
import { nextReviewDate } from '../common/utils/date.util';
import { KnowledgePointsService } from '../knowledge-points/knowledge-points.service';
import { StudentsService } from '../students/students.service';
import { UploadsService } from '../uploads/uploads.service';
import {
  BatchCreateQuestionsDto,
  BatchQuestionActionDto,
  CreateQuestionDto,
  QueryQuestionsDto,
  QuestionInputDto,
  UpdateQuestionDto,
} from './dto/question.dto';

@Injectable()
export class WrongQuestionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly students: StudentsService,
    private readonly uploads: UploadsService,
    private readonly knowledgePoints: KnowledgePointsService,
  ) {}

  async list(userId: string, query: QueryQuestionsDto): Promise<{
    items: WrongQuestion[];
    total: number;
    page: number;
    pageSize: number;
  }> {
    const student = await this.students.resolveStudent(userId, query.studentId);
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const where: Prisma.WrongQuestionWhereInput = {
      userId,
      studentId: student.id,
      deletedAt: null,
      status: query.status ?? 'ACTIVE',
      ...(query.subjectId ? { subjectId: query.subjectId } : {}),
      ...(query.grade ? { grade: query.grade } : {}),
      ...(query.semester ? { semester: query.semester } : {}),
      ...(query.questionType ? { questionType: query.questionType } : {}),
      ...(query.knowledgePointId
        ? { knowledgePoints: { some: { knowledgePointId: query.knowledgePointId } } }
        : {}),
      ...(query.masteryMin !== undefined || query.masteryMax !== undefined
        ? {
            mastery: {
              ...(query.masteryMin !== undefined ? { gte: query.masteryMin } : {}),
              ...(query.masteryMax !== undefined ? { lte: query.masteryMax } : {}),
            },
          }
        : {}),
      ...(query.dateFrom || query.dateTo
        ? {
            createdAt: {
              ...(query.dateFrom ? { gte: new Date(query.dateFrom) } : {}),
              ...(query.dateTo ? { lte: endOfDay(query.dateTo) } : {}),
            },
          }
        : {}),
      ...(query.keyword
        ? {
            OR: [
              { stem: { contains: query.keyword, mode: 'insensitive' } },
              { correctAnswer: { contains: query.keyword, mode: 'insensitive' } },
              { studentAnswer: { contains: query.keyword, mode: 'insensitive' } },
              { analysis: { contains: query.keyword, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [total, questions] = await this.prisma.$transaction([
      this.prisma.wrongQuestion.count({ where }),
      this.prisma.wrongQuestion.findMany({
        where,
        include: this.listInclude(),
        orderBy: { [query.sortBy ?? 'createdAt']: query.sortOrder ?? 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    return {
      items: questions.map((question) => this.toDto(question)),
      total,
      page,
      pageSize,
    };
  }

  async get(userId: string, id: string): Promise<WrongQuestion> {
    const question = await this.prisma.wrongQuestion.findFirst({
      where: { id, userId, deletedAt: null },
      include: this.detailInclude(),
    });
    if (!question) throw new NotFoundException('错题不存在');
    return this.toDto(question);
  }

  async create(userId: string, dto: CreateQuestionDto): Promise<WrongQuestion> {
    const result = await this.createMany(userId, {
      studentId: dto.studentId,
      sourceJobId: dto.sourceJobId,
      questions: [dto],
    });
    return this.get(userId, result.ids[0]);
  }

  async createMany(
    userId: string,
    dto: BatchCreateQuestionsDto,
  ): Promise<{ created: number; ids: string[] }> {
    const student = await this.students.getOwned(userId, dto.studentId);
    if (!dto.questions.length) throw new BadRequestException('请至少保存一道错题');

    const subjectIds = Array.from(new Set(dto.questions.map((question) => question.subjectId)));
    const subjects = await this.prisma.subject.findMany({ where: { id: { in: subjectIds } } });
    if (subjects.length !== subjectIds.length) throw new BadRequestException('学科不存在');

    const allUploadIds = dto.questions.flatMap((question) => [
      ...(question.sourceImageIds ?? []),
      ...(question.figureImageIds ?? []),
    ]);
    await this.assertUploads(userId, allUploadIds);

    const ids: string[] = [];
    await this.prisma.$transaction(async (tx) => {
      for (const input of dto.questions) {
        const question = await tx.wrongQuestion.create({
          data: {
            userId,
            studentId: student.id,
            subjectId: input.subjectId,
            grade: input.grade ?? student.grade,
            semester: input.semester ?? student.semester,
            questionType: input.questionType,
            stem: input.stem.trim(),
            ...(input.options !== undefined
              ? { options: input.options as unknown as Prisma.InputJsonValue }
              : {}),
            correctAnswer: input.correctAnswer?.trim() || null,
            studentAnswer: input.studentAnswer?.trim() || null,
            analysis: input.analysis?.trim() || null,
            errorReason: input.errorReason?.trim() || null,
            note: input.note?.trim() || null,
            difficulty: input.difficulty ?? 3,
            mastery: input.mastery ?? 0,
            source: input.source ?? (dto.sourceJobId ? 'AI' : 'MANUAL'),
            sourceJobId: input.sourceJobId ?? dto.sourceJobId,
            nextReviewAt: nextReviewDate(1),
          },
        });

        const imageRows: Prisma.QuestionImageCreateManyInput[] = [];
        (input.sourceImageIds ?? []).forEach((uploadFileId, index) => {
          imageRows.push({ wrongQuestionId: question.id, uploadFileId, kind: 'SOURCE', sortOrder: index });
        });
        (input.figureImageIds ?? []).forEach((uploadFileId, index) => {
          imageRows.push({ wrongQuestionId: question.id, uploadFileId, kind: 'FIGURE', sortOrder: index });
        });
        if (imageRows.length) await tx.questionImage.createMany({ data: imageRows });

        await this.knowledgePoints.resolveAndAttach(
          tx,
          question.id,
          input.subjectId,
          input.knowledgePoints ?? [],
        );
        ids.push(question.id);
      }
    });

    return { created: ids.length, ids };
  }

  async update(userId: string, id: string, dto: UpdateQuestionDto): Promise<WrongQuestion> {
    const existing = await this.prisma.wrongQuestion.findFirst({
      where: { id, userId, deletedAt: null },
      include: {
        subject: true,
        knowledgePoints: { include: { knowledgePoint: true } },
        images: true,
      },
    });
    if (!existing) throw new NotFoundException('错题不存在');

    if (dto.subjectId && dto.subjectId !== existing.subjectId) {
      const subject = await this.prisma.subject.findUnique({ where: { id: dto.subjectId } });
      if (!subject) throw new BadRequestException('学科不存在');
    }
    await this.assertUploads(userId, [
      ...(dto.sourceImageIds ?? []),
      ...(dto.figureImageIds ?? []),
    ]);

    const subjectId = dto.subjectId ?? existing.subjectId;
    const knowledgeNames =
      dto.knowledgePoints !== undefined
        ? dto.knowledgePoints
        : dto.subjectId && dto.subjectId !== existing.subjectId
          ? existing.knowledgePoints.map((link) => link.knowledgePoint.name)
          : undefined;

    await this.prisma.$transaction(async (tx) => {
      await tx.wrongQuestion.update({
        where: { id },
        data: {
          ...(dto.subjectId !== undefined ? { subjectId: dto.subjectId } : {}),
          ...(dto.grade !== undefined ? { grade: dto.grade } : {}),
          ...(dto.semester !== undefined ? { semester: dto.semester } : {}),
          ...(dto.questionType !== undefined ? { questionType: dto.questionType } : {}),
          ...(dto.stem !== undefined ? { stem: dto.stem.trim() } : {}),
          ...(dto.options !== undefined
            ? { options: dto.options as unknown as Prisma.InputJsonValue }
            : {}),
          ...(dto.correctAnswer !== undefined ? { correctAnswer: dto.correctAnswer.trim() || null } : {}),
          ...(dto.studentAnswer !== undefined ? { studentAnswer: dto.studentAnswer.trim() || null } : {}),
          ...(dto.analysis !== undefined ? { analysis: dto.analysis.trim() || null } : {}),
          ...(dto.errorReason !== undefined ? { errorReason: dto.errorReason.trim() || null } : {}),
          ...(dto.note !== undefined ? { note: dto.note.trim() || null } : {}),
          ...(dto.difficulty !== undefined ? { difficulty: dto.difficulty } : {}),
          ...(dto.mastery !== undefined ? { mastery: dto.mastery } : {}),
        },
      });

      if (knowledgeNames !== undefined) {
        await this.knowledgePoints.replaceForQuestion(tx, id, subjectId, knowledgeNames);
      }

      if (dto.sourceImageIds !== undefined) {
        await tx.questionImage.deleteMany({ where: { wrongQuestionId: id, kind: 'SOURCE' } });
        if (dto.sourceImageIds.length) {
          await tx.questionImage.createMany({
            data: dto.sourceImageIds.map((uploadFileId, index) => ({
              wrongQuestionId: id,
              uploadFileId,
              kind: 'SOURCE',
              sortOrder: index,
            })),
          });
        }
      }
      if (dto.figureImageIds !== undefined) {
        await tx.questionImage.deleteMany({ where: { wrongQuestionId: id, kind: 'FIGURE' } });
        if (dto.figureImageIds.length) {
          await tx.questionImage.createMany({
            data: dto.figureImageIds.map((uploadFileId, index) => ({
              wrongQuestionId: id,
              uploadFileId,
              kind: 'FIGURE',
              sortOrder: index,
            })),
          });
        }
      }
    });

    return this.get(userId, id);
  }

  async remove(userId: string, id: string): Promise<{ success: boolean }> {
    const result = await this.prisma.wrongQuestion.updateMany({
      where: { id, userId, deletedAt: null },
      data: { deletedAt: new Date(), status: 'ARCHIVED' },
    });
    if (!result.count) throw new NotFoundException('错题不存在');
    return { success: true };
  }

  async batchAction(
    userId: string,
    dto: BatchQuestionActionDto,
  ): Promise<{ updated: number }> {
    const data: Prisma.WrongQuestionUpdateManyMutationInput =
      dto.action === 'delete'
        ? { deletedAt: new Date(), status: 'ARCHIVED' }
        : dto.action === 'archive'
          ? { status: 'ARCHIVED' }
          : { status: 'ACTIVE' };
    const result = await this.prisma.wrongQuestion.updateMany({
      where: { userId, id: { in: dto.ids }, deletedAt: null },
      data,
    });
    return { updated: result.count };
  }

  async findOwned(userId: string, id: string) {
    const question = await this.prisma.wrongQuestion.findFirst({
      where: { id, userId, deletedAt: null },
      include: { subject: true },
    });
    if (!question) throw new NotFoundException('错题不存在');
    return question;
  }

  async findDue(userId: string, studentId: string, end: Date): Promise<WrongQuestion[]> {
    const questions = await this.prisma.wrongQuestion.findMany({
      where: {
        userId,
        studentId,
        deletedAt: null,
        status: 'ACTIVE',
        nextReviewAt: { lte: end },
      },
      include: this.detailInclude(),
      orderBy: { nextReviewAt: 'asc' },
    });
    return questions.map((question) => this.toDto(question));
  }

  private async assertUploads(userId: string, ids: string[]): Promise<void> {
    const unique = Array.from(new Set(ids.filter(Boolean)));
    if (!unique.length) return;
    const count = await this.prisma.uploadFile.count({ where: { userId, id: { in: unique } } });
    if (count !== unique.length) throw new BadRequestException('部分图片不存在或无权访问');
  }

  private listInclude(): Prisma.WrongQuestionInclude {
    return {
      subject: true,
      knowledgePoints: { include: { knowledgePoint: true } },
      images: {
        orderBy: { sortOrder: 'asc' },
        take: 1,
        include: { uploadFile: true },
      },
    };
  }

  private detailInclude(): Prisma.WrongQuestionInclude {
    return {
      subject: true,
      knowledgePoints: { include: { knowledgePoint: true } },
      images: { orderBy: { sortOrder: 'asc' }, include: { uploadFile: true } },
    };
  }

  toDto(question: any): WrongQuestion {
    const subject: SubjectDto | undefined = question.subject
      ? {
          id: question.subject.id,
          name: question.subject.name,
          shortName: question.subject.shortName,
          stages: question.subject.stages,
          color: question.subject.color,
          sortOrder: question.subject.sortOrder,
        }
      : undefined;

    return {
      id: question.id,
      studentId: question.studentId,
      subjectId: question.subjectId,
      subject,
      grade: question.grade,
      semester: question.semester,
      questionType: question.questionType,
      stem: question.stem,
      options: (question.options as QuestionOption[] | null) ?? null,
      correctAnswer: question.correctAnswer,
      studentAnswer: question.studentAnswer,
      analysis: question.analysis,
      errorReason: question.errorReason,
      difficulty: question.difficulty,
      mastery: question.mastery,
      status: question.status as QuestionStatus,
      source: question.source,
      note: question.note,
      knowledgePoints: (question.knowledgePoints ?? []).map(
        (link: any): KnowledgePointDto => ({
          id: link.knowledgePoint.id,
          subjectId: link.knowledgePoint.subjectId,
          name: link.knowledgePoint.name,
          aliases: link.knowledgePoint.aliases,
          gradeMin: link.knowledgePoint.gradeMin,
          gradeMax: link.knowledgePoint.gradeMax,
          usageCount: link.knowledgePoint.usageCount,
        }),
      ),
      images: (question.images ?? []).map((image: any) => ({
        id: image.id,
        kind: image.kind,
        url: this.uploads.urlFor(image.uploadFile),
        thumbnailUrl: this.uploads.thumbnailUrlFor(image.uploadFile),
        width: image.uploadFile.width,
        height: image.uploadFile.height,
      })),
      reviewCount: question.reviewCount,
      intervalDays: question.intervalDays,
      nextReviewAt: question.nextReviewAt.toISOString(),
      lastReviewedAt: question.lastReviewedAt?.toISOString() ?? null,
      createdAt: question.createdAt.toISOString(),
      updatedAt: question.updatedAt.toISOString(),
    };
  }
}
