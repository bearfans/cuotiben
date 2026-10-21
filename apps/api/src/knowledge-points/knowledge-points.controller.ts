import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import {
  CreateKnowledgePointDto,
  MergeKnowledgePointDto,
  QueryKnowledgePointDto,
  UpdateKnowledgePointDto,
} from './dto/knowledge-point.dto';
import { KnowledgePointsService } from './knowledge-points.service';

@ApiTags('knowledge-points')
@ApiBearerAuth()
@Controller('knowledge-points')
export class KnowledgePointsController {
  constructor(private readonly knowledgePointsService: KnowledgePointsService) {}

  @Get()
  list(@Query() query: QueryKnowledgePointDto) {
    return this.knowledgePointsService.list(query);
  }

  @Post()
  create(@Body() dto: CreateKnowledgePointDto) {
    return this.knowledgePointsService.create(dto);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateKnowledgePointDto) {
    return this.knowledgePointsService.update(id, dto);
  }

  @Post(':id/merge')
  merge(@Param('id') id: string, @Body() dto: MergeKnowledgePointDto) {
    return this.knowledgePointsService.merge(id, dto.targetId);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.knowledgePointsService.remove(id);
  }
}
