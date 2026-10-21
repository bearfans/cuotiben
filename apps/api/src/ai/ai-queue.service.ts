import { forwardRef, Inject, Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Queue, Worker, type ConnectionOptions } from 'bullmq';
import { AiService } from './ai.service';

@Injectable()
export class AiQueueService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AiQueueService.name);
  private readonly enabled: boolean;
  private readonly redisUrl: string;
  private readonly concurrency: number;
  private queue?: Queue;
  private worker?: Worker;

  constructor(
    @Inject(forwardRef(() => AiService)) private readonly aiService: AiService,
    private readonly config: ConfigService,
  ) {
    this.enabled = this.config.get<boolean>('queue.enabled') ?? false;
    this.redisUrl = this.config.get<string>('queue.redisUrl') ?? 'redis://localhost:6379';
    this.concurrency = this.config.get<number>('queue.concurrency') ?? 2;
  }

  onModuleInit(): void {
    if (!this.enabled) {
      this.logger.log('AI queue disabled, jobs run in-process');
      return;
    }
    const connection = this.parseRedisUrl(this.redisUrl);
    this.queue = new Queue('ai-recognition', { connection });
    this.worker = new Worker(
      'ai-recognition',
      async (job) => this.aiService.processJob(job.data.jobId as string),
      { connection, concurrency: this.concurrency },
    );
    this.worker.on('failed', (job, error) => {
      this.logger.error(`AI job ${job?.id ?? 'unknown'} failed: ${error.message}`);
    });
    this.logger.log(`AI queue enabled: ${this.redisUrl}`);
  }

  async enqueue(jobId: string): Promise<void> {
    if (this.queue) {
      await this.queue.add(
        'recognize',
        { jobId },
        {
          attempts: 1,
          removeOnComplete: 100,
          removeOnFail: 100,
        },
      );
      return;
    }
    setImmediate(() => {
      void this.aiService.processJob(jobId).catch((error) => {
        this.logger.error(`Inline AI job ${jobId} failed: ${(error as Error).message}`);
      });
    });
  }

  async onModuleDestroy(): Promise<void> {
    await this.worker?.close();
    await this.queue?.close();
  }

  private parseRedisUrl(value: string): ConnectionOptions {
    const url = new URL(value);
    return {
      host: url.hostname,
      port: Number(url.port || 6379),
      ...(url.username ? { username: decodeURIComponent(url.username) } : {}),
      ...(url.password ? { password: decodeURIComponent(url.password) } : {}),
      ...(url.pathname && url.pathname !== '/' ? { db: Number(url.pathname.slice(1)) } : {}),
      maxRetriesPerRequest: null,
      ...(url.protocol === 'rediss:' ? { tls: {} } : {}),
    };
  }
}
