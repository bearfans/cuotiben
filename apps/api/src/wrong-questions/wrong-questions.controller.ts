import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/auth/current-user.decorator';
import type { AuthUser } from '../common/auth/auth-user';
import {
  BatchCreateQuestionsDto,
  BatchQuestionActionDto,
  CreateQuestionDto,
  QueryQuestionsDto,
  UpdateQuestionDto,
} from './dto/question.dto';
import { WrongQuestionsService } from './wrong-questions.service';

@ApiTags('wrong-questions')
@ApiBearerAuth()
@Controller('wrong-questions')
export class WrongQuestionsController {
  constructor(private readonly wrongQuestionsService: WrongQuestionsService) {}

  @Get()
  list(@CurrentUser() user: AuthUser, @Query() query: QueryQuestionsDto) {
    return this.wrongQuestionsService.list(user.id, query);
  }

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateQuestionDto) {
    return this.wrongQuestionsService.create(user.id, dto);
  }

  @Post('batch')
  createMany(@CurrentUser() user: AuthUser, @Body() dto: BatchCreateQuestionsDto) {
    return this.wrongQuestionsService.createMany(user.id, dto);
  }

  @Post('batch-action')
  batchAction(@CurrentUser() user: AuthUser, @Body() dto: BatchQuestionActionDto) {
    return this.wrongQuestionsService.batchAction(user.id, dto);
  }

  @Get(':id')
  get(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.wrongQuestionsService.get(user.id, id);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdateQuestionDto,
  ) {
    return this.wrongQuestionsService.update(user.id, id, dto);
  }

  @Delete(':id')
  remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.wrongQuestionsService.remove(user.id, id);
  }
}
