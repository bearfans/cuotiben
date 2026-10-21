import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, type KnowledgePoint } from '@prisma/client';
import { normalizeKnowledgePoint, type KnowledgePoint as KnowledgePointDto } from '@myos/shared';
import { PrismaService } from '../common/prisma/prisma.service';
import {
  CreateKnowledgePointDto,
  QueryKnowledgePointDto,
  UpdateKnowledgePointDto,
} from './dto/knowledge-point.dto';

@Injectable()
export class KnowledgePointsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(query: QueryKnowledgePointDto): Promise<KnowledgePointDto[]> {
    const where: Prisma.KnowledgePointWhereInput = {
      status: 'ACTIVE',
      ...(query.subjectId ? { subjectId: query.subjectId } : {}),
      ...(query.q
        ? {
            OR: [
              { name: { contains: query.q, mode: 'insensitive' } },
              { normalizedName: { contains: query.q.toLowerCase() } },
              { aliases: { has: normalizeKnowledgePoint(query.q) } },
            ],
          }
        : {}),
      ...(query.grade
        ? {
            AND: [
              { OR: [{ gradeMin: null }, { gradeMin: { lte: query.grade } }] },
              { OR: [{ gradeMax: null }, { gradeMax: { gte: query.grade } }] },
            ],
          }
        : {}),
    };
    const points = await this.prisma.knowledgePoint.findMany({
      where,
      orderBy: [{ usageCount: 'desc' }, { name: 'asc' }],
      take: query.limit ?? 50,
      include: {
        _count: {
          select: {
            wrongQuestionLinks: {
              where: { wrongQuestion: { deletedAt: null, status: 'ACTIVE' } },
            },
          },
        },
      },
    });
    return points.map((point) => this.toDto(point, point._count.wrongQuestionLinks));
  }

  async create(dto: CreateKnowledgePointDto): Promise<KnowledgePointDto> {
    const normalizedName = normalizeKnowledgePoint(dto.name);
    if (!normalizedName) throw new BadRequestException('知识点名称不能为空');
    const existing = await this.prisma.knowledgePoint.findUnique({
      where: { subjectId_normalizedName: { subjectId: dto.subjectId, normalizedName } },
    });
    if (existing) return this.toDto(existing);

    const point = await this.prisma.knowledgePoint.create({
      data: {
        subjectId: dto.subjectId,
        name: dto.name.trim(),
        normalizedName,
        aliases: (dto.aliases ?? []).map(normalizeKnowledgePoint).filter(Boolean),
        gradeMin: dto.gradeMin,
        gradeMax: dto.gradeMax,
        createdBy: 'USER',
      },
    });
    return this.toDto(point);
  }

  async update(id: string, dto: UpdateKnowledgePointDto): Promise<KnowledgePointDto> {
    const existing = await this.getById(id);
    const name = dto.name?.trim() ?? existing.name;
    const normalizedName = normalizeKnowledgePoint(name);
    if (!normalizedName) throw new BadRequestException('知识点名称不能为空');

    const conflict = await this.prisma.knowledgePoint.findFirst({
      where: {
        subjectId: existing.subjectId,
        normalizedName,
        id: { not: id },
        status: 'ACTIVE',
      },
    });
    if (conflict) throw new BadRequestException('该学科下已存在同名知识点');

    const point = await this.prisma.knowledgePoint.update({
      where: { id },
      data: {
        name,
        normalizedName,
        ...(dto.aliases !== undefined
          ? { aliases: dto.aliases.map(normalizeKnowledgePoint).filter(Boolean) }
          : {}),
        ...(dto.gradeMin !== undefined ? { gradeMin: dto.gradeMin } : {}),
        ...(dto.gradeMax !== undefined ? { gradeMax: dto.gradeMax } : {}),
      },
    });
    return this.toDto(point);
  }

  async merge(sourceId: string, targetId: string): Promise<KnowledgePointDto> {
    if (sourceId === targetId) throw new BadRequestException('不能合并到自身');
    return this.prisma.$transaction(async (tx) => {
      const source = await tx.knowledgePoint.findUnique({ where: { id: sourceId } });
      const target = await tx.knowledgePoint.findUnique({ where: { id: targetId } });
      if (!source || !target) throw new NotFoundException('知识点不存在');
      if (source.subjectId !== target.subjectId) throw new BadRequestException('只能合并同学科的知识点');
      if (source.status === 'MERGED') throw new BadRequestException('该知识点已合并');

      const links = await tx.wrongQuestionKnowledgePoint.findMany({ where: { knowledgePointId: sourceId } });
      for (const link of links) {
        await tx.wrongQuestionKnowledgePoint.upsert({
          where: {
            wrongQuestionId_knowledgePointId: {
              wrongQuestionId: link.wrongQuestionId,
              knowledgePointId: targetId,
            },
          },
          update: { confidence: link.confidence ?? undefined },
          create: {
            wrongQuestionId: link.wrongQuestionId,
            knowledgePointId: targetId,
            confidence: link.confidence ?? undefined,
          },
        });
      }
      await tx.wrongQuestionKnowledgePoint.deleteMany({ where: { knowledgePointId: sourceId } });

      const targetUsage = await tx.wrongQuestionKnowledgePoint.count({ where: { knowledgePointId: targetId } });
      const mergedAliases = Array.from(
        new Set([
          ...target.aliases,
          source.normalizedName,
          ...source.aliases,
        ]),
      );

      await tx.knowledgePoint.update({
        where: { id: sourceId },
        data: {
          status: 'MERGED',
          mergedIntoId: targetId,
          usageCount: 0,
          aliases: [],
        },
      });
      const updated = await tx.knowledgePoint.update({
        where: { id: targetId },
        data: { usageCount: targetUsage, aliases: mergedAliases },
      });
      return this.toDto(updated);
    });
  }

  async remove(id: string): Promise<{ success: boolean }> {
    const point = await this.getById(id);
    if (point.usageCount > 0) {
      throw new BadRequestException('该知识点已关联错题，请先合并或解除关联');
    }
    await this.prisma.knowledgePoint.delete({ where: { id } });
    return { success: true };
  }

  async getById(id: string): Promise<KnowledgePoint> {
    const point = await this.prisma.knowledgePoint.findUnique({ where: { id } });
    if (!point) throw new NotFoundException('知识点不存在');
    return point;
  }

  async resolveAndAttach(
    tx: Prisma.TransactionClient,
    wrongQuestionId: string,
    subjectId: string,
    names: string[],
    confidences?: Record<string, number>,
  ): Promise<KnowledgePoint[]> {
    const unique = Array.from(new Set(names.map((name) => name.trim()).filter(Boolean)));
    const attached: KnowledgePoint[] = [];
    for (const name of unique.slice(0, 8)) {
      const normalized = normalizeKnowledgePoint(name);
      if (!normalized) continue;
      let point = await tx.knowledgePoint.findFirst({
        where: {
          subjectId,
          status: 'ACTIVE',
          OR: [{ normalizedName: normalized }, { aliases: { has: normalized } }],
        },
      });
      if (!point) {
        point = await tx.knowledgePoint.create({
          data: {
            subjectId,
            name,
            normalizedName: normalized,
            createdBy: 'AI',
          },
        });
      }
      await tx.wrongQuestionKnowledgePoint.upsert({
        where: {
          wrongQuestionId_knowledgePointId: {
            wrongQuestionId,
            knowledgePointId: point.id,
          },
        },
        update: { confidence: confidences?.[normalized] ?? undefined },
        create: {
          wrongQuestionId,
          knowledgePointId: point.id,
          confidence: confidences?.[normalized] ?? undefined,
        },
      });
      await tx.knowledgePoint.update({
        where: { id: point.id },
        data: { usageCount: { increment: 1 } },
      });
      attached.push(point);
    }
    return attached;
  }

  async replaceForQuestion(
    tx: Prisma.TransactionClient,
    wrongQuestionId: string,
    subjectId: string,
    names: string[],
    confidences?: Record<string, number>,
  ): Promise<KnowledgePoint[]> {
    const links = await tx.wrongQuestionKnowledgePoint.findMany({ where: { wrongQuestionId } });
    for (const link of links) {
      await tx.knowledgePoint.updateMany({
        where: { id: link.knowledgePointId, usageCount: { gt: 0 } },
        data: { usageCount: { decrement: 1 } },
      });
    }
    await tx.wrongQuestionKnowledgePoint.deleteMany({ where: { wrongQuestionId } });
    return this.resolveAndAttach(tx, wrongQuestionId, subjectId, names, confidences);
  }

  private toDto(point: KnowledgePoint, usageCount = point.usageCount): KnowledgePointDto {
    return {
      id: point.id,
      subjectId: point.subjectId,
      name: point.name,
      aliases: point.aliases,
      gradeMin: point.gradeMin,
      gradeMax: point.gradeMax,
      usageCount,
    };
  }
}
