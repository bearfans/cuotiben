import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/auth/current-user.decorator';
import type { AuthUser } from '../common/auth/auth-user';
import {
  CompleteReviewDto,
  ReviewCalendarQueryDto,
  ReviewHistoryQueryDto,
  ReviewTodayQueryDto,
  SnoozeReviewDto,
} from './dto/review.dto';
import { ReviewService } from './review.service';

@ApiTags('review')
@ApiBearerAuth()
@Controller('review')
export class ReviewController {
  constructor(private readonly reviewService: ReviewService) {}

  @Get('today')
  today(@CurrentUser() user: AuthUser, @Query() query: ReviewTodayQueryDto) {
    return this.reviewService.today(user.id, query.studentId);
  }

  @Post(':id/complete')
  complete(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: CompleteReviewDto,
  ) {
    return this.reviewService.complete(user.id, id, dto);
  }

  @Post(':id/snooze')
  snooze(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: SnoozeReviewDto,
  ) {
    return this.reviewService.snooze(user.id, id, dto);
  }

  @Get('calendar')
  calendar(@CurrentUser() user: AuthUser, @Query() query: ReviewCalendarQueryDto) {
    return this.reviewService.calendar(user.id, query);
  }

  @Get('history')
  history(@CurrentUser() user: AuthUser, @Query() query: ReviewHistoryQueryDto) {
    return this.reviewService.history(user.id, query);
  }
}
