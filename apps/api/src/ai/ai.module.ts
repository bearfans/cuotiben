import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { StudentsModule } from '../students/students.module';
import { UploadsModule } from '../uploads/uploads.module';
import { AiController } from './ai.controller';
import { AiQueueService } from './ai-queue.service';
import { AiService } from './ai.service';
import { AI_PROVIDER } from './ai.types';
import { MockAiProvider } from './providers/mock.provider';
import { OpenAiProvider } from './providers/openai.provider';

@Module({
  imports: [UploadsModule, StudentsModule],
  controllers: [AiController],
  providers: [
    AiService,
    AiQueueService,
    {
      provide: AI_PROVIDER,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const provider = config.get<string>('ai.provider') ?? 'mock';
        if (provider === 'mock') return new MockAiProvider();
        return new OpenAiProvider(config);
      },
    },
  ],
  exports: [AiService],
})
export class AiModule {}
