import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleDestroy,
  OnModuleInit,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { UploadFile } from '@prisma/client';
import { createHash, createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import sharp from 'sharp';
import type { UploadedFile } from '@myos/shared';
import { PrismaService } from '../common/prisma/prisma.service';
import { StorageService } from './storage.service';

const MAX_FILES = 9;
const MAX_FILE_SIZE = 10 * 1024 * 1024;

/** 未被识别任务消费的临时图片保留时长。 */
const TEMP_UPLOAD_TTL_MS = 2 * 60 * 60 * 1000;
const TEMP_UPLOAD_CLEANUP_INTERVAL_MS = 30 * 60 * 1000;

interface FileTokenPayload {
  f: string;
  u: string;
  e: number;
}

@Injectable()
export class UploadsService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(UploadsService.name);
  private readonly signingSecret: string;
  private readonly ttlSeconds: number;
  private readonly tempDir: string;
  private cleanupTimer?: NodeJS.Timeout;

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly config: ConfigService,
  ) {
    this.signingSecret = this.config.get<string>('storage.signingSecret') ?? 'dev-file-secret';
    this.ttlSeconds = this.config.get<number>('storage.urlTtlSeconds') ?? 86400;
    this.tempDir = resolve(tmpdir(), 'myos-uploads');
  }

  async onModuleInit(): Promise<void> {
    await mkdir(this.tempDir, { recursive: true });
    void this.cleanupExpiredUploads().catch((error) => {
      this.logger.error(`临时图片清理失败：${(error as Error).message}`);
    });
    this.cleanupTimer = setInterval(() => {
      void this.cleanupExpiredUploads().catch((error) => {
        this.logger.error(`临时图片清理失败：${(error as Error).message}`);
      });
    }, TEMP_UPLOAD_CLEANUP_INTERVAL_MS);
    this.cleanupTimer.unref();
  }

  onModuleDestroy(): void {
    if (this.cleanupTimer) clearInterval(this.cleanupTimer);
  }

  async saveMany(userId: string, files: Express.Multer.File[]): Promise<UploadedFile[]> {
    if (!files?.length) throw new BadRequestException('请选择要上传的图片');
    if (files.length > MAX_FILES) throw new BadRequestException(`一次最多上传 ${MAX_FILES} 张图片`);

    const saved: UploadedFile[] = [];
    const savedIds: string[] = [];

    try {
      for (const file of files) {
        if (!file.mimetype.startsWith('image/')) {
          throw new BadRequestException(`${file.originalname} 不是图片文件`);
        }
        if (file.size > MAX_FILE_SIZE) {
          throw new BadRequestException(`${file.originalname} 超过 10MB`);
        }

        const processed = await sharp(file.buffer, { failOn: 'none' })
          .rotate()
          .resize({ width: 2400, height: 2400, fit: 'inside', withoutEnlargement: true })
          .jpeg({ quality: 90, mozjpeg: true })
          .toBuffer({ resolveWithObject: true });

        // 图片只写入系统临时目录，识别结束后立即删除，不进入持久化存储卷。
        const storageKey = join(this.tempDir, `${randomUUID()}.jpg`);
        await writeFile(storageKey, processed.data);

        try {
          const record = await this.prisma.uploadFile.create({
            data: {
              userId,
              storageKey,
              thumbnailKey: null,
              temporary: true,
              mimeType: 'image/jpeg',
              size: processed.info.size,
              width: processed.info.width,
              height: processed.info.height,
              sha256: createHash('sha256').update(file.buffer).digest('hex'),
              originalName: file.originalname,
            },
          });
          saved.push(this.toPublic(record));
          savedIds.push(record.id);
        } catch (error) {
          await unlink(storageKey).catch(() => undefined);
          throw error;
        }
      }
      return saved;
    } catch (error) {
      await this.discardUploads(savedIds).catch(() => undefined);
      if (error instanceof BadRequestException) throw error;
      throw new BadRequestException(`图片处理失败：${(error as Error).message}`);
    }
  }

  async getOwned(fileId: string, userId: string): Promise<UploadFile> {
    const file = await this.prisma.uploadFile.findFirst({ where: { id: fileId, userId } });
    if (!file) throw new NotFoundException('图片不存在');
    return file;
  }

  async getBufferForUser(
    fileId: string,
    userId: string,
  ): Promise<{ file: UploadFile; buffer: Buffer }> {
    const file = await this.getOwned(fileId, userId);
    return { file, buffer: await this.readStoredFile(file) };
  }

  async getBufferByStorageKey(key: string): Promise<Buffer> {
    return this.storage.getBuffer(key);
  }

  async putGenerated(key: string, buffer: Buffer, contentType: string): Promise<void> {
    await this.storage.put(key, buffer, contentType);
  }

  async deleteByKey(key: string): Promise<void> {
    await this.storage.delete(key);
  }

  /** 删除识别结束后的临时图片文件及上传记录。 */
  async discardUploads(fileIds: string[]): Promise<void> {
    const unique = Array.from(new Set(fileIds.filter(Boolean)));
    if (!unique.length) return;

    const files = await this.prisma.uploadFile.findMany({
      where: { id: { in: unique }, temporary: true },
      select: { id: true, storageKey: true },
    });
    if (!files.length) return;

    await Promise.allSettled(files.map((file) => unlink(file.storageKey)));
    await this.prisma.uploadFile.deleteMany({
      where: { id: { in: files.map((file) => file.id) } },
    });
  }

  async readByToken(
    fileId: string,
    token: string,
    variant?: string,
  ): Promise<{ buffer: Buffer; mimeType: string }> {
    const payload = this.verifyToken(token);
    if (payload.f !== fileId) throw new UnauthorizedException('图片访问凭证无效');
    const file = await this.prisma.uploadFile.findFirst({
      where: { id: fileId, userId: payload.u },
    });
    if (!file) throw new NotFoundException('图片不存在');
    const key = variant === 'thumb' && file.thumbnailKey ? file.thumbnailKey : file.storageKey;

    try {
      if (file.temporary) {
        return { buffer: await readFile(key), mimeType: 'image/jpeg' };
      }
      return { buffer: await this.storage.getBuffer(key), mimeType: 'image/jpeg' };
    } catch {
      throw new NotFoundException('图片已清理');
    }
  }

  urlFor(file: UploadFile): string {
    return `/api/v1/files/${file.id}?token=${this.signToken(file.id, file.userId)}`;
  }

  thumbnailUrlFor(file: UploadFile): string {
    if (!file.thumbnailKey) return this.urlFor(file);
    return `/api/v1/files/${file.id}?variant=thumb&token=${this.signToken(file.id, file.userId)}`;
  }

  signToken(fileId: string, userId: string): string {
    const payload: FileTokenPayload = {
      f: fileId,
      u: userId,
      e: Math.floor(Date.now() / 1000) + this.ttlSeconds,
    };
    const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
    const signature = createHmac('sha256', this.signingSecret).update(body).digest('base64url');
    return `${body}.${signature}`;
  }

  private async readStoredFile(file: UploadFile): Promise<Buffer> {
    if (file.temporary) return readFile(file.storageKey);
    return this.storage.getBuffer(file.storageKey);
  }

  private async cleanupExpiredUploads(): Promise<void> {
    const expired = await this.prisma.uploadFile.findMany({
      where: {
        temporary: true,
        createdAt: { lt: new Date(Date.now() - TEMP_UPLOAD_TTL_MS) },
      },
      select: { id: true },
      take: 500,
    });
    if (!expired.length) return;

    await this.discardUploads(expired.map((file) => file.id));
    this.logger.log(`已清理 ${expired.length} 个过期临时图片`);
  }

  private verifyToken(token: string): FileTokenPayload {
    const [body, signature] = token.split('.');
    if (!body || !signature) throw new UnauthorizedException('图片访问凭证无效');
    const expected = createHmac('sha256', this.signingSecret).update(body).digest('base64url');
    const left = Buffer.from(signature);
    const right = Buffer.from(expected);
    if (left.length !== right.length || !timingSafeEqual(left, right)) {
      throw new UnauthorizedException('图片访问凭证无效');
    }
    try {
      const payload = JSON.parse(Buffer.from(body, 'base64url').toString()) as FileTokenPayload;
      if (payload.e * 1000 <= Date.now()) throw new UnauthorizedException('图片访问已过期');
      return payload;
    } catch (error) {
      if (error instanceof UnauthorizedException) throw error;
      throw new UnauthorizedException('图片访问凭证无效');
    }
  }

  private toPublic(file: UploadFile): UploadedFile {
    return {
      id: file.id,
      width: file.width ?? 0,
      height: file.height ?? 0,
      mimeType: file.mimeType,
      size: file.size,
    };
  }
}
