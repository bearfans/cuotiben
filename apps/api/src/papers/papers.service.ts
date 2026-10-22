import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { createHmac, timingSafeEqual } from 'node:crypto';
import {
  SUBJECT_MAP,
  type Paper as PaperDto,
  type PaperCandidate,
  type PaperQuestionSnapshot,
  type PaperSettings,
  type QuestionOption,
} from '@myos/shared';
import { PrismaService } from '../common/prisma/prisma.service';
import { endOfDay } from '../common/utils/date.util';
import { StudentsService } from '../students/students.service';
import { UploadsService } from '../uploads/uploads.service';
import {
  CreatePaperDto,
  PaperListQueryDto,
  SelectCandidatesDto,
  UpdatePaperDto,
} from './dto/paper.dto';
import { PaperPrintService } from './paper-print.service';
import { PdfService } from './pdf.service';

type PaperWithItems = Prisma.PaperGetPayload<{
  include: { student: true; subject: true; items: true };
}>;

interface PaperTokenPayload {
  p: string;
  u: string;
  e: number;
}

@Injectable()
export class PapersService {
  private readonly signingSecret: string;
  private readonly tokenTtl: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly students: StudentsService,
    private readonly uploads: UploadsService,
    private readonly print: PaperPrintService,
    private readonly pdf: PdfService,
    private readonly config: ConfigService,
  ) {
    this.signingSecret = this.config.get<string>('pdf.signingSecret') ?? 'dev-paper-secret';
    this.tokenTtl = this.config.get<number>('pdf.tokenTtlSeconds') ?? 900;
  }

  async selectCandidates(userId: string, dto: SelectCandidatesDto) {
    const student = await this.students.resolveStudent(userId, dto.studentId);
    const where: Prisma.WrongQuestionWhereInput = {
      userId,
      studentId: student.id,
      deletedAt: null,
      status: 'ACTIVE',
      ...(dto.subjectId ? { subjectId: dto.subjectId } : {}),
      ...(dto.questionTypes?.length ? { questionType: { in: dto.questionTypes } } : {}),
      ...(dto.masteryMax !== undefined ? { mastery: { lte: dto.masteryMax } } : {}),
      ...(dto.knowledgePointIds?.length
        ? { knowledgePoints: { some: { knowledgePointId: { in: dto.knowledgePointIds } } } }
        : {}),
      ...(dto.dateFrom || dto.dateTo
        ? {
            createdAt: {
              ...(dto.dateFrom ? { gte: new Date(dto.dateFrom) } : {}),
              ...(dto.dateTo ? { lte: endOfDay(dto.dateTo) } : {}),
            },
          }
        : {}),
      ...(dto.keyword
        ? {
            OR: [
              { stem: { contains: dto.keyword, mode: 'insensitive' } },
              { correctAnswer: { contains: dto.keyword, mode: 'insensitive' } },
            ],
          }
        : {}),
      ...(dto.questionIds?.length ? { id: { in: dto.questionIds } } : {}),
    };

    const total = await this.prisma.wrongQuestion.count({ where });
    const questions = await this.prisma.wrongQuestion.findMany({
      where,
      select: {
        id: true,
        stem: true,
        subjectId: true,
        questionType: true,
        mastery: true,
        difficulty: true,
        createdAt: true,
        knowledgePoints: {
          select: { knowledgePoint: { select: { id: true, name: true } } },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: dto.questionIds?.length ? Math.max(dto.questionIds.length, 1) : 500,
    });

    let selected = questions;
    if (dto.random && !dto.questionIds?.length) {
      selected = shuffle(questions).slice(0, dto.count ?? 20);
    } else if (!dto.questionIds?.length) {
      selected = questions.slice(0, dto.count ?? 100);
    } else {
      const order = new Map(dto.questionIds.map((id, index) => [id, index]));
      selected = questions.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
    }

    const items: PaperCandidate[] = selected.map((question) => ({
      id: question.id,
      stem: question.stem,
      subjectId: question.subjectId,
      questionType: question.questionType,
      mastery: question.mastery,
      difficulty: question.difficulty,
      createdAt: question.createdAt.toISOString(),
      knowledgePoints: question.knowledgePoints.map((link) => link.knowledgePoint),
    }));
    return { items, total };
  }

  async create(userId: string, dto: CreatePaperDto): Promise<PaperDto> {
    const student = await this.students.resolveStudent(userId, dto.studentId);
    const ids = Array.from(new Set(dto.questionIds));
    const questions = await this.prisma.wrongQuestion.findMany({
      where: {
        id: { in: ids },
        userId,
        studentId: student.id,
        deletedAt: null,
        status: 'ACTIVE',
      },
      include: {
        subject: true,
        knowledgePoints: { include: { knowledgePoint: true } },
        images: { orderBy: { sortOrder: 'asc' } },
      },
    });
    if (questions.length !== ids.length) {
      throw new BadRequestException('部分错题不存在、已删除或不属于当前孩子');
    }
    const byId = new Map(questions.map((question) => [question.id, question]));
    const ordered = ids.map((id) => byId.get(id)).filter(Boolean) as typeof questions;
    const subjectIds = new Set(ordered.map((question) => question.subjectId));
    const subjectId =
      dto.subjectId ??
      (subjectIds.size === 1 ? ordered[0]?.subjectId ?? null : null);
    const subjectName = subjectId ? SUBJECT_MAP[subjectId]?.name : undefined;
    const settings: PaperSettings = {
      includeAnswers: dto.settings?.includeAnswers ?? true,
      includeKnowledgePoints: dto.settings?.includeKnowledgePoints ?? true,
      includeStudentAnswer: dto.settings?.includeStudentAnswer ?? false,
      showScore: dto.settings?.showScore ?? true,
    };
    const title =
      dto.title?.trim() ||
      `${student.name} · ${subjectName ? `${subjectName}错题` : '错题'}重练卷`;

    const groups = new Map<string, typeof ordered>();
    for (const question of ordered) {
      const section = this.sectionFor(question.questionType);
      const list = groups.get(section) ?? [];
      list.push(question);
      groups.set(section, list);
    }
    const orderedQuestions = ['CHOICE', 'TRUE_FALSE', 'FILL_BLANK', 'SHORT_ANSWER', 'OTHER']
      .flatMap((section) => groups.get(section) ?? []);

    const items = orderedQuestions.map((question, index) => {
      const snapshot: PaperQuestionSnapshot = {
        questionId: question.id,
        subjectId: question.subjectId,
        subjectName: question.subject.name,
        grade: question.grade,
        semester: question.semester,
        questionType: question.questionType,
        stem: question.stem,
        options: (question.options as QuestionOption[] | null) ?? null,
        correctAnswer: question.correctAnswer,
        studentAnswer: question.studentAnswer,
        analysis: question.analysis,
        knowledgePoints: question.knowledgePoints.map((link) => link.knowledgePoint.name),
        difficulty: question.difficulty,
        images: question.images.map((image) => ({
          id: image.uploadFileId,
          kind: image.kind,
        })),
      };
      return {
        wrongQuestionId: question.id,
        sortOrder: index,
        section: this.sectionFor(question.questionType),
        snapshot: snapshot as unknown as Prisma.InputJsonValue,
      };
    });

    const paper = await this.prisma.paper.create({
      data: {
        userId,
        studentId: student.id,
        subjectId,
        title,
        grade: student.grade,
        questionCount: items.length,
        settings: settings as unknown as Prisma.InputJsonValue,
        items: { create: items },
      },
    });
    return this.get(userId, paper.id);
  }

  async list(userId: string, query: PaperListQueryDto): Promise<PaperDto[]> {
    const student = query.studentId
      ? await this.students.getOwned(userId, query.studentId)
      : undefined;
    const papers = await this.prisma.paper.findMany({
      where: {
        userId,
        deletedAt: null,
        ...(student ? { studentId: student.id } : {}),
      },
      include: {
        subject: true,
        _count: { select: { items: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    return papers.map((paper) => ({
      id: paper.id,
      studentId: paper.studentId,
      title: paper.title,
      subjectId: paper.subjectId,
      grade: paper.grade as PaperDto['grade'],
      questionCount: paper._count.items,
      settings: paper.settings as unknown as PaperSettings,
      status: paper.status,
      hasPdf: Boolean(paper.pdfKey),
      createdAt: paper.createdAt.toISOString(),
      updatedAt: paper.updatedAt.toISOString(),
    }));
  }

  async get(userId: string, id: string): Promise<PaperDto> {
    const paper = await this.prisma.paper.findFirst({
      where: { id, userId, deletedAt: null },
      include: { student: true, subject: true, items: { orderBy: { sortOrder: 'asc' } } },
    });
    if (!paper) throw new NotFoundException('试卷不存在');
    return this.toDto(paper);
  }

  async update(userId: string, id: string, dto: UpdatePaperDto): Promise<PaperDto> {
    const existing = await this.prisma.paper.findFirst({ where: { id, userId, deletedAt: null } });
    if (!existing) throw new NotFoundException('试卷不存在');
    if (existing.pdfKey) {
      await this.uploads.deleteByKey(existing.pdfKey);
    }
    await this.prisma.paper.update({
      where: { id },
      data: {
        ...(dto.title !== undefined ? { title: dto.title.trim() } : {}),
        ...(dto.settings !== undefined
          ? {
              settings: {
                ...(existing.settings as object),
                ...dto.settings,
              } as unknown as Prisma.InputJsonValue,
            }
          : {}),
        pdfKey: null,
      },
    });
    return this.get(userId, id);
  }

  async updateMastery(
    userId: string,
    id: string,
    mastery: number,
  ): Promise<{ updated: number }> {
    const paper = await this.prisma.paper.findFirst({
      where: { id, userId, deletedAt: null },
      select: { items: { select: { wrongQuestionId: true } } },
    });
    if (!paper) throw new NotFoundException('试卷不存在');

    const questionIds = Array.from(
      new Set(
        paper.items
          .map((item) => item.wrongQuestionId)
          .filter((questionId): questionId is string => Boolean(questionId)),
      ),
    );
    if (!questionIds.length) return { updated: 0 };

    const result = await this.prisma.wrongQuestion.updateMany({
      where: { userId, id: { in: questionIds }, deletedAt: null },
      data: { mastery },
    });
    return { updated: result.count };
  }

  async remove(userId: string, id: string): Promise<{ success: boolean }> {
    const existing = await this.prisma.paper.findFirst({ where: { id, userId, deletedAt: null } });
    if (!existing) throw new NotFoundException('试卷不存在');
    if (existing.pdfKey) await this.uploads.deleteByKey(existing.pdfKey);
    await this.prisma.paper.update({
      where: { id },
      data: { deletedAt: new Date(), pdfKey: null },
    });
    return { success: true };
  }

  async printToken(userId: string, id: string) {
    const paper = await this.prisma.paper.findFirst({ where: { id, userId, deletedAt: null } });
    if (!paper) throw new NotFoundException('试卷不存在');
    const token = this.signToken(paper.id, userId);
    const expiresAt = new Date((Math.floor(Date.now() / 1000) + this.tokenTtl) * 1000).toISOString();
    return {
      token,
      expiresAt,
      url: `/api/v1/papers/${paper.id}/print?token=${token}`,
      pdfUrl: `/api/v1/papers/${paper.id}/pdf?token=${token}`,
    };
  }

  async getPrintHtml(token: string, id: string): Promise<string> {
    const paper = await this.getByToken(token, id);
    return this.print.render(paper, { toolbar: true });
  }

  async getPdfByToken(token: string, id: string): Promise<{ buffer: Buffer; title: string }> {
    const paper = await this.getByToken(token, id);
    return { buffer: await this.getPdf(paper.userId, paper.id), title: paper.title };
  }

  async getPdf(userId: string, id: string, regenerate = false): Promise<Buffer> {
    const paper = await this.prisma.paper.findFirst({
      where: { id, userId, deletedAt: null },
      include: { student: true, subject: true, items: { orderBy: { sortOrder: 'asc' } } },
    });
    if (!paper) throw new NotFoundException('试卷不存在');
    if (paper.pdfKey && !regenerate) {
      try {
        return await this.uploads.getBufferByStorageKey(paper.pdfKey);
      } catch {
        // Regenerate if the cached file is missing.
      }
    }
    const html = await this.print.render(paper);
    const buffer = await this.pdf.generate(html);
    const key = `papers/${userId}/${paper.id}.pdf`;
    await this.uploads.putGenerated(key, buffer, 'application/pdf');
    await this.prisma.paper.update({ where: { id }, data: { pdfKey: key } });
    return buffer;
  }

  private async getByToken(token: string, id: string): Promise<PaperWithItems> {
    const payload = this.verifyToken(token);
    if (payload.p !== id) throw new UnauthorizedException('试卷访问凭证无效');
    const paper = await this.prisma.paper.findFirst({
      where: { id, userId: payload.u, deletedAt: null },
      include: { student: true, subject: true, items: { orderBy: { sortOrder: 'asc' } } },
    });
    if (!paper) throw new NotFoundException('试卷不存在');
    return paper;
  }

  private toDto(paper: PaperWithItems): PaperDto {
    return {
      id: paper.id,
      studentId: paper.studentId,
      title: paper.title,
      subjectId: paper.subjectId,
      grade: paper.grade as PaperDto['grade'],
      questionCount: paper.questionCount,
      settings: paper.settings as unknown as PaperSettings,
      status: paper.status,
      hasPdf: Boolean(paper.pdfKey),
      createdAt: paper.createdAt.toISOString(),
      updatedAt: paper.updatedAt.toISOString(),
      items: paper.items.map((item) => {
        const snapshot = item.snapshot as unknown as PaperQuestionSnapshot;
        return {
          id: item.id,
          sortOrder: item.sortOrder,
          section: item.section,
          snapshot: {
            ...snapshot,
            images: (snapshot.images ?? []).map((image) => ({
              ...image,
              url: `/api/v1/files/${image.id}?token=${this.uploads.signToken(image.id, paper.userId)}`,
            })),
          },
        };
      }),
    };
  }

  private sectionFor(type: string): string {
    if (type === 'SINGLE_CHOICE' || type === 'MULTIPLE_CHOICE') return 'CHOICE';
    if (type === 'TRUE_FALSE') return 'TRUE_FALSE';
    if (type === 'FILL_BLANK') return 'FILL_BLANK';
    if (type === 'SHORT_ANSWER') return 'SHORT_ANSWER';
    return 'OTHER';
  }

  private signToken(paperId: string, userId: string): string {
    const payload: PaperTokenPayload = {
      p: paperId,
      u: userId,
      e: Math.floor(Date.now() / 1000) + this.tokenTtl,
    };
    const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
    const signature = createHmac('sha256', this.signingSecret).update(body).digest('base64url');
    return `${body}.${signature}`;
  }

  private verifyToken(token: string): PaperTokenPayload {
    const [body, signature] = token.split('.');
    if (!body || !signature) throw new UnauthorizedException('试卷访问凭证无效');
    const expected = createHmac('sha256', this.signingSecret).update(body).digest('base64url');
    const left = Buffer.from(signature);
    const right = Buffer.from(expected);
    if (left.length !== right.length || !timingSafeEqual(left, right)) {
      throw new UnauthorizedException('试卷访问凭证无效');
    }
    try {
      const payload = JSON.parse(Buffer.from(body, 'base64url').toString()) as PaperTokenPayload;
      if (payload.e * 1000 <= Date.now()) throw new UnauthorizedException('试卷访问已过期');
      return payload;
    } catch (error) {
      if (error instanceof UnauthorizedException) throw error;
      throw new UnauthorizedException('试卷访问凭证无效');
    }
  }
}

function shuffle<T>(items: T[]): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}
