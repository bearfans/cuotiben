import { BadRequestException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { UploadFile } from '@prisma/client';
import { createHash, createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import sharp from 'sharp';
import type { UploadedFile } from '@myos/shared';
import { PrismaService } from '../common/prisma/prisma.service';
import { StorageService } from './storage.service';

const MAX_FILES = 9;
const MAX_FILE_SIZE = 10 * 1024 * 1024;

interface FileTokenPayload {
  f: string;
  u: string;
  e: number;
}

@Injectable()
export class UploadsService {
  private readonly signingSecret: string;
  private readonly ttlSeconds: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly config: ConfigService,
  ) {
    this.signingSecret = this.config.get<string>('storage.signingSecret') ?? 'dev-file-secret';
    this.ttlSeconds = this.config.get<number>('storage.urlTtlSeconds') ?? 86400;
  }

  async saveMany(userId: string, files: Express.Multer.File[]): Promise<UploadedFile[]> {
    if (!files?.length) throw new BadRequestException('请选择要上传的图片');
    if (files.length > MAX_FILES) throw new BadRequestException(`一次最多上传 ${MAX_FILES} 张图片`);

    const saved: UploadedFile[] = [];
    for (const file of files) {
      if (!file.mimetype.startsWith('image/')) {
        throw new BadRequestException(`${file.originalname} 不是图片文件`);
      }
      if (file.size > MAX_FILE_SIZE) {
        throw new BadRequestException(`${file.originalname} 超过 10MB`);
      }

      try {
        const processed = await sharp(file.buffer, { failOn: 'none' })
          .rotate()
          .resize({ width: 2400, height: 2400, fit: 'inside', withoutEnlargement: true })
          .jpeg({ quality: 90, mozjpeg: true })
          .toBuffer({ resolveWithObject: true });
        const thumbnail = await sharp(processed.data)
          .resize({ width: 480, height: 480, fit: 'inside', withoutEnlargement: true })
          .jpeg({ quality: 78 })
          .toBuffer();

        const now = new Date();
        const key = `uploads/${userId}/${now.getUTCFullYear()}/${String(now.getUTCMonth() + 1).padStart(2, '0')}/${crypto.randomUUID()}.jpg`;
        const thumbnailKey = key.replace(/\.jpg$/, '.thumb.jpg');
        await this.storage.put(key, processed.data, 'image/jpeg');
        await this.storage.put(thumbnailKey, thumbnail, 'image/jpeg');

        const record = await this.prisma.uploadFile.create({
          data: {
            userId,
            storageKey: key,
            thumbnailKey,
            mimeType: 'image/jpeg',
            size: processed.info.size,
            width: processed.info.width,
            height: processed.info.height,
            sha256: createHash('sha256').update(file.buffer).digest('hex'),
            originalName: file.originalname,
          },
        });
        saved.push(this.toPublic(record));
      } catch (error) {
        if (error instanceof BadRequestException) throw error;
        throw new BadRequestException(`图片处理失败：${(error as Error).message}`);
      }
    }
    return saved;
  }

  async toPublicDto(file: UploadFile): Promise<UploadedFile> {
    return this.toPublic(file);
  }

  async getOwned(fileId: string, userId: string): Promise<UploadFile> {
    const file = await this.prisma.uploadFile.findFirst({ where: { id: fileId, userId } });
    if (!file) throw new NotFoundException('图片不存在');
    return file;
  }

  async getBufferForUser(fileId: string, userId: string): Promise<{ file: UploadFile; buffer: Buffer }> {
    const file = await this.getOwned(fileId, userId);
    return { file, buffer: await this.storage.getBuffer(file.storageKey) };
  }

  async getBufferByStorageKey(key: string): Promise<Buffer> {
    return this.storage.getBuffer(key);
  }

  async putGenerated(key: string, buffer: Buffer, contentType: string): Promise<void> {
    await this.storage.put(key, buffer, contentType);
  }

  /**
   * 用拼接后的长图替换某张图片的存储内容。
   * 先写新文件、再切换数据库指向，失败时旧原图仍然可用。
   */
  async replaceWithStitchedImage(
    fileId: string,
    userId: string,
    buffer: Buffer,
    width: number,
    height: number,
  ): Promise<void> {
    const file = await this.getOwned(fileId, userId);

    const thumbnail = await sharp(buffer)
      .resize({ width: 480, height: 480, fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 78 })
      .toBuffer();

    const baseKey = file.storageKey.replace(/\.[^./]+$/, '');
    const key = `${baseKey}-stitched-${randomUUID()}.jpg`;
    const thumbnailKey = key.replace(/\.jpg$/, '.thumb.jpg');
    await this.storage.put(key, buffer, 'image/jpeg');
    await this.storage.put(thumbnailKey, thumbnail, 'image/jpeg');

    await this.prisma.uploadFile.update({
      where: { id: file.id },
      data: {
        storageKey: key,
        thumbnailKey,
        mimeType: 'image/jpeg',
        size: buffer.length,
        width,
        height,
        sha256: createHash('sha256').update(buffer).digest('hex'),
      },
    });

    // 旧文件清理失败不影响主流程
    try {
      await this.storage.delete(file.storageKey);
      if (file.thumbnailKey) await this.storage.delete(file.thumbnailKey);
    } catch {
      // ignore
    }
  }

  async deleteByKey(key: string): Promise<void> {
    await this.storage.delete(key);
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
    return { buffer: await this.storage.getBuffer(key), mimeType: 'image/jpeg' };
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
      url: this.urlFor(file),
      thumbnailUrl: this.thumbnailUrlFor(file),
      width: file.width ?? 0,
      height: file.height ?? 0,
      mimeType: file.mimeType,
      size: file.size,
    };
  }
}
