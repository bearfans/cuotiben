import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as Minio from 'minio';
import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

@Injectable()
export class StorageService implements OnModuleInit {
  private readonly logger = new Logger(StorageService.name);
  private readonly driver: string;
  private readonly localDir: string;
  private readonly bucket: string;
  private readonly client?: Minio.Client;

  constructor(private readonly config: ConfigService) {
    this.driver = this.config.get<string>('storage.driver') ?? 'local';
    this.localDir = resolve(this.config.get<string>('storage.localDir') ?? './storage');
    this.bucket = this.config.get<string>('s3.bucket') ?? 'myos';
    if (this.driver === 's3') {
      this.client = new Minio.Client({
        endPoint: this.config.get<string>('s3.endPoint') ?? 'localhost',
        port: this.config.get<number>('s3.port') ?? 9000,
        useSSL: this.config.get<boolean>('s3.useSSL') ?? false,
        accessKey: this.config.get<string>('s3.accessKey') ?? 'myos',
        secretKey: this.config.get<string>('s3.secretKey') ?? 'myos-secret',
        region: this.config.get<string>('s3.region') ?? 'us-east-1',
      });
    }
  }

  async onModuleInit(): Promise<void> {
    if (this.driver === 's3' && this.client) {
      try {
        const exists = await this.client.bucketExists(this.bucket);
        if (!exists) {
          await this.client.makeBucket(this.bucket);
          this.logger.log(`Created MinIO bucket: ${this.bucket}`);
        }
      } catch (error) {
        this.logger.error(`MinIO bucket initialization failed: ${(error as Error).message}`);
      }
    } else {
      await mkdir(this.localDir, { recursive: true });
    }
  }

  async put(key: string, buffer: Buffer, contentType = 'application/octet-stream'): Promise<void> {
    if (this.driver === 's3' && this.client) {
      await this.client.putObject(this.bucket, key, buffer, buffer.length, {
        'Content-Type': contentType,
      });
      return;
    }
    const target = this.safeLocalPath(key);
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, buffer);
  }

  async getBuffer(key: string): Promise<Buffer> {
    if (this.driver === 's3' && this.client) {
      const stream = await this.client.getObject(this.bucket, key);
      return streamToBuffer(stream);
    }
    return readFile(this.safeLocalPath(key));
  }

  async delete(key: string): Promise<void> {
    if (this.driver === 's3' && this.client) {
      await this.client.removeObject(this.bucket, key);
      return;
    }
    try {
      await unlink(this.safeLocalPath(key));
    } catch {
      // Ignore missing files.
    }
  }

  private safeLocalPath(key: string): string {
    const target = resolve(this.localDir, key);
    if (!target.startsWith(this.localDir)) {
      throw new Error('Invalid storage key');
    }
    return target;
  }
}

async function streamToBuffer(stream: NodeJS.ReadableStream): Promise<Buffer> {
  const chunks: Buffer[] = [];
  return new Promise((resolvePromise, reject) => {
    stream.on('data', (chunk: Buffer) => chunks.push(Buffer.from(chunk)));
    stream.on('end', () => resolvePromise(Buffer.concat(chunks)));
    stream.on('error', reject);
  });
}
