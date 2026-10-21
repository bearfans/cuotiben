import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsUUID, Matches, Max, Min } from 'class-validator';
import { ReviewRating } from '@prisma/client';

export class CompleteReviewDto {
  @IsEnum(ReviewRating)
  rating!: ReviewRating;
}

export class SnoozeReviewDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(30)
  days?: number;
}

export class ReviewTodayQueryDto {
  @IsOptional()
  @IsUUID()
  studentId?: string;
}

export class ReviewCalendarQueryDto {
  @IsOptional()
  @IsUUID()
  studentId?: string;

  @Matches(/^\d{4}-\d{2}$/, { message: '月份格式应为 YYYY-MM' })
  month!: string;
}

export class ReviewHistoryQueryDto {
  @IsOptional()
  @IsUUID()
  studentId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize?: number;
}
