import {
  BadRequestException,
  forwardRef,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import {
  SUBJECTS,
  SUBJECT_MAP,
  normalizeAiPayload,
  type AiJob,
  type AiRecognitionPayload,
} from '@myos/shared';
import { PrismaService } from '../common/prisma/prisma.service';
import { startOfToday } from '../common/utils/date.util';
import { StudentsService } from '../students/students.service';
import { UploadsService } from '../uploads/uploads.service';
import { AiQueueService } from './ai-queue.service';
import { AI_PROVIDER, type AiProvider } from './ai.types';
import { CreateAiJobDto } from './dto/create-ai-job.dto';

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly students: StudentsService,
    private readonly uploads: UploadsService,
    @Inject(AI_PROVIDER) private readonly provider: AiProvider,
    @Inject(forwardRef(() => AiQueueService)) private readonly queue: AiQueueService,
  ) {}

  async createJob(userId: string, dto: CreateAiJobDto): Promise<AiJob> {
    const student = await this.students.resolveStudent(userId, dto.studentId);
    const uploadIds = Array.from(new Set(dto.uploadIds));
    const files = await this.prisma.uploadFile.findMany({
      where: { id: { in: uploadIds }, userId },
    });
    if (files.length !== uploadIds.length) {
      throw new BadRequestException('部分图片不存在或无权访问');
    }
    if (files.length > 9) throw new BadRequestException('一次最多识别 9 张图片');

    const used = await this.prisma.aiJob.count({
      where: { userId, createdAt: { gte: startOfToday() } },
    });
    const limit = this.config.get<number>('ai.dailyJobLimit') ?? 50;
    if (used >= limit) {
      throw new HttpException(`今日识别次数已用完（${limit} 次），请明天再试`, HttpStatus.TOO_MANY_REQUESTS);
    }

    const subjectHint =
      dto.subjectHint && SUBJECT_MAP[dto.subjectHint] ? dto.subjectHint : null;
    const job = await this.prisma.aiJob.create({
      data: {
        userId,
        studentId: student.id,
        grade: student.grade,
        semester: student.semester,
        subjectHint,
        imageCount: files.length,
        model: this.config.get<string>('ai.model') ?? 'unknown',
        promptVersion: this.config.get<string>('ai.promptVersion') ?? 'v1',
        images: {
          create: files.map((file, index) => ({
            uploadFileId: file.id,
            sortOrder: index,
          })),
        },
      },
    });
    await this.queue.enqueue(job.id);
    return this.getJob(userId, job.id);
  }

  async processJob(jobId: string): Promise<void> {
    const job = await this.prisma.aiJob.findUnique({
      where: { id: jobId },
      include: {
        images: { orderBy: { sortOrder: 'asc' }, include: { uploadFile: true } },
      },
    });
    if (!job) return;
    if (job.status === 'SUCCEEDED') return;

    await this.prisma.aiJob.update({
      where: { id: jobId },
      data: { status: 'PROCESSING', startedAt: new Date(), error: null },
    });

    let tokensIn = 0;
    let tokensOut = 0;
    const errors: string[] = [];

    try {
      for (const image of job.images) {
        if (image.status === 'SUCCEEDED' && image.result) continue;
        await this.prisma.aiJobImage.update({
          where: { id: image.id },
          data: { status: 'PROCESSING', error: null },
        });

        try {
          const { buffer } = await this.uploads.getBufferForUser(image.uploadFileId, job.userId);
          const output = await this.provider.recognize({
            image: buffer,
            mimeType: image.uploadFile.mimeType,
            grade: job.grade,
            semester: job.semester,
            subjectHint: job.subjectHint,
          });
          const normalized = this.normalizePayloadSubject(output.payload, job.subjectHint);
          const confidence =
            normalized.questions.length > 0
              ? normalized.questions.reduce((sum, question) => sum + question.confidence, 0) /
                normalized.questions.length
              : null;
          tokensIn += output.tokensIn;
          tokensOut += output.tokensOut;

          await this.prisma.aiJobImage.update({
            where: { id: image.id },
            data: {
              status: 'SUCCEEDED',
              result: normalized as unknown as Prisma.InputJsonValue,
              rawResponse: output.raw as Prisma.InputJsonValue,
              confidence,
              error: null,
            },
          });
        } catch (error) {
          const message = (error as Error).message || '识别失败';
          errors.push(message);
          await this.prisma.aiJobImage.update({
            where: { id: image.id },
            data: { status: 'FAILED', error: message.slice(0, 1000) },
          });
        }
      }

      const images = await this.prisma.aiJobImage.findMany({ where: { jobId } });
      const succeeded = images.filter((image) => image.status === 'SUCCEEDED').length;
      const status =
        succeeded === images.length ? 'SUCCEEDED' : succeeded > 0 ? 'PARTIAL' : 'FAILED';
      await this.prisma.aiJob.update({
        where: { id: jobId },
        data: {
          status,
          tokensIn,
          tokensOut,
          finishedAt: new Date(),
          error: errors.length ? errors.slice(0, 3).join('；').slice(0, 2000) : null,
        },
      });
    } catch (error) {
      this.logger.error(`AI job ${jobId} crashed: ${(error as Error).message}`);
      await this.prisma.aiJob.update({
        where: { id: jobId },
        data: {
          status: 'FAILED',
          finishedAt: new Date(),
          error: (error as Error).message.slice(0, 2000),
        },
      });
    }
  }

  async getJob(userId: string, id: string): Promise<AiJob> {
    const job = await this.prisma.aiJob.findFirst({
      where: { id, userId },
      include: {
        images: { orderBy: { sortOrder: 'asc' }, include: { uploadFile: true } },
      },
    });
    if (!job) throw new NotFoundException('识别任务不存在');

    return {
      id: job.id,
      status: job.status,
      studentId: job.studentId,
      grade: job.grade as AiJob['grade'],
      semester: job.semester,
      subjectHint: job.subjectHint,
      imageCount: job.imageCount,
      model: job.model,
      error: job.error,
      createdAt: job.createdAt.toISOString(),
      finishedAt: job.finishedAt?.toISOString() ?? null,
      images: job.images.map((image) => ({
        id: image.id,
        uploadFileId: image.uploadFileId,
        status: image.status,
        imageUrl: this.uploads.urlFor(image.uploadFile),
        thumbnailUrl: this.uploads.thumbnailUrlFor(image.uploadFile),
        result: image.result as AiJob['images'][number]['result'],
        error: image.error,
        confidence: image.confidence,
      })),
    };
  }

  async retry(userId: string, id: string): Promise<AiJob> {
    const job = await this.prisma.aiJob.findFirst({ where: { id, userId } });
    if (!job) throw new NotFoundException('识别任务不存在');
    if (!['FAILED', 'PARTIAL'].includes(job.status)) {
      throw new BadRequestException('当前任务不需要重试');
    }
    await this.prisma.aiJobImage.updateMany({
      where: { jobId: id, status: 'FAILED' },
      data: { status: 'PENDING', error: null, result: Prisma.JsonNull, rawResponse: Prisma.JsonNull },
    });
    await this.prisma.aiJob.update({
      where: { id },
      data: { status: 'PENDING', error: null, finishedAt: null },
    });
    await this.queue.enqueue(id);
    return this.getJob(userId, id);
  }

  async quota(userId: string): Promise<{ used: number; limit: number; remaining: number }> {
    const used = await this.prisma.aiJob.count({
      where: { userId, createdAt: { gte: startOfToday() } },
    });
    const limit = this.config.get<number>('ai.dailyJobLimit') ?? 50;
    return { used, limit, remaining: Math.max(0, limit - used) };
  }

  private normalizePayloadSubject(
    payload: AiRecognitionPayload,
    subjectHint: string | null,
  ): AiRecognitionPayload {
    const normalized = normalizeAiPayload(payload);
    let subjectId = subjectHint && SUBJECT_MAP[subjectHint] ? subjectHint : null;
    if (!subjectId && normalized.subject) {
      const value = normalized.subject.trim();
      if (SUBJECT_MAP[value]) {
        subjectId = value;
      } else {
        const matched = SUBJECTS.find(
          (subject) => subject.name === value || subject.shortName === value,
        );
        if (matched) subjectId = matched.id;
      }
    }
    return { ...normalized, subject: subjectId ?? 'other' };
  }
}
