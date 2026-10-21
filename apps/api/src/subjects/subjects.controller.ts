import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { SubjectsService } from './subjects.service';

@ApiTags('subjects')
@ApiBearerAuth()
@Controller('subjects')
export class SubjectsController {
  constructor(private readonly subjectsService: SubjectsService) {}

  @Get()
  list(@Query('grade') grade?: string) {
    const parsed = grade ? Number.parseInt(grade, 10) : undefined;
    return this.subjectsService.list(Number.isFinite(parsed) ? parsed : undefined);
  }
}
