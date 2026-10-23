import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/auth/current-user.decorator';
import type { AuthUser } from '../common/auth/auth-user';
import { AiService } from './ai.service';
import { CreateAiJobDto } from './dto/create-ai-job.dto';

@ApiTags('ai')
@ApiBearerAuth()
@Controller('ai')
export class AiController {
  constructor(private readonly aiService: AiService) {}

  @Post('jobs')
  @Throttle({ default: { limit: 12, ttl: 60_000 } })
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateAiJobDto) {
    return this.aiService.createJob(user.id, dto);
  }

  @Get('jobs/:id')
  get(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.aiService.getJob(user.id, id);
  }

  @Get('quota')
  quota(@CurrentUser() user: AuthUser) {
    return this.aiService.quota(user.id);
  }
}
