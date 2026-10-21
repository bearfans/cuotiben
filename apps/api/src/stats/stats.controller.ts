import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/auth/current-user.decorator';
import type { AuthUser } from '../common/auth/auth-user';
import { KnowledgeStatsQueryDto, OverviewQueryDto } from './dto/stats.dto';
import { StatsService } from './stats.service';

@ApiTags('stats')
@ApiBearerAuth()
@Controller('stats')
export class StatsController {
  constructor(private readonly statsService: StatsService) {}

  @Get('overview')
  overview(@CurrentUser() user: AuthUser, @Query() query: OverviewQueryDto) {
    return this.statsService.overview(user.id, query);
  }

  @Get('knowledge')
  knowledge(@CurrentUser() user: AuthUser, @Query() query: KnowledgeStatsQueryDto) {
    return this.statsService.knowledge(user.id, query);
  }
}
