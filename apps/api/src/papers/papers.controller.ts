import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Res,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { CurrentUser } from '../common/auth/current-user.decorator';
import type { AuthUser } from '../common/auth/auth-user';
import { Public } from '../common/auth/public.decorator';
import {
  CreatePaperDto,
  PaperListQueryDto,
  SelectCandidatesDto,
  UpdatePaperDto,
} from './dto/paper.dto';
import { PapersService } from './papers.service';

@ApiTags('papers')
@ApiBearerAuth()
@Controller('papers')
export class PapersController {
  constructor(private readonly papersService: PapersService) {}

  @Get()
  list(@CurrentUser() user: AuthUser, @Query() query: PaperListQueryDto) {
    return this.papersService.list(user.id, query);
  }

  @Post('candidates')
  candidates(@CurrentUser() user: AuthUser, @Body() dto: SelectCandidatesDto) {
    return this.papersService.selectCandidates(user.id, dto);
  }

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreatePaperDto) {
    return this.papersService.create(user.id, dto);
  }

  @Get(':id/print-token')
  printToken(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.papersService.printToken(user.id, id);
  }

  @Get(':id')
  get(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.papersService.get(user.id, id);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdatePaperDto,
  ) {
    return this.papersService.update(user.id, id, dto);
  }

  @Delete(':id')
  remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.papersService.remove(user.id, id);
  }
}

@ApiTags('paper-print')
@Controller('papers')
export class PaperPrintController {
  constructor(private readonly papersService: PapersService) {}

  @Public()
  @Get(':id/print')
  async print(
    @Param('id') id: string,
    @Query('token') token: string,
    @Res() res: Response,
  ): Promise<void> {
    const html = await this.papersService.getPrintHtml(token, id);
    res.type('text/html; charset=utf-8').send(html);
  }

  @Public()
  @Throttle({ default: { limit: 8, ttl: 60_000 } })
  @Get(':id/pdf')
  async pdf(
    @Param('id') id: string,
    @Query('token') token: string,
    @Res() res: Response,
  ): Promise<void> {
    const { buffer, title } = await this.papersService.getPdfByToken(token, id);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Length', buffer.length);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename*=UTF-8''${encodeURIComponent(title)}.pdf`,
    );
    res.setHeader('Cache-Control', 'private, no-store');
    res.send(buffer);
  }
}
