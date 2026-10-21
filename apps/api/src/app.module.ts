import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AiModule } from './ai/ai.module';
import { AuthModule } from './auth/auth.module';
import { JwtAuthGuard } from './common/auth/jwt-auth.guard';
import { PrismaModule } from './common/prisma/prisma.module';
import configuration from './config/configuration';
import { HealthModule } from './health/health.module';
import { KnowledgePointsModule } from './knowledge-points/knowledge-points.module';
import { PapersModule } from './papers/papers.module';
import { StatsModule } from './stats/stats.module';
import { StudentsModule } from './students/students.module';
import { SubjectsModule } from './subjects/subjects.module';
import { UploadsModule } from './uploads/uploads.module';
import { WrongQuestionsModule } from './wrong-questions/wrong-questions.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      load: [configuration],
      envFilePath: ['.env.local', '.env'],
    }),
    ThrottlerModule.forRoot([
      {
        ttl: 60_000,
        limit: 180,
      },
    ]),
    PrismaModule,
    HealthModule,
    AuthModule,
    StudentsModule,
    SubjectsModule,
    KnowledgePointsModule,
    UploadsModule,
    AiModule,
    WrongQuestionsModule,
    StatsModule,
    PapersModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
  ],
})
export class AppModule {}
