import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { QuestionType } from '@prisma/client';

export class PaperSettingsDto {
  @IsOptional()
  @IsBoolean()
  includeAnswers?: boolean;

  @IsOptional()
  @IsBoolean()
  includeKnowledgePoints?: boolean;

  @IsOptional()
  @IsBoolean()
  includeStudentAnswer?: boolean;

  @IsOptional()
  @IsBoolean()
  showScore?: boolean;
}

export class SelectCandidatesDto {
  @IsOptional()
  @IsUUID()
  studentId?: string;

  @IsOptional()
  @IsString()
  subjectId?: string;

  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  knowledgePointIds?: string[];

  @IsOptional()
  @IsArray()
  @IsEnum(QuestionType, { each: true })
  questionTypes?: QuestionType[];

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(5)
  masteryMax?: number;

  @IsOptional()
  @IsDateString()
  dateFrom?: string;

  @IsOptional()
  @IsDateString()
  dateTo?: string;

  @IsOptional()
  @IsString()
  keyword?: string;

  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  @ArrayMaxSize(200)
  questionIds?: string[];

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  count?: number;

  @IsOptional()
  @IsBoolean()
  random?: boolean;
}

export class CreatePaperDto {
  @IsUUID()
  studentId!: string;

  @IsOptional()
  @IsString()
  @Length(1, 80)
  title?: string;

  @IsOptional()
  @IsString()
  subjectId?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  @IsUUID('4', { each: true })
  questionIds!: string[];

  @IsOptional()
  @ValidateNested()
  @Type(() => PaperSettingsDto)
  settings?: PaperSettingsDto;
}

export class UpdatePaperDto {
  @IsOptional()
  @IsString()
  @Length(1, 80)
  title?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => PaperSettingsDto)
  settings?: PaperSettingsDto;
}

export class UpdatePaperMasteryDto {
  @IsInt()
  @Min(0)
  @Max(5)
  mastery!: number;
}

export class PaperListQueryDto {
  @IsOptional()
  @IsUUID()
  studentId?: string;
}
