import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { QuestionSource, QuestionStatus, QuestionType, Semester } from '@prisma/client';

export class QuestionOptionDto {
  @IsString()
  @Length(1, 10)
  label!: string;

  @IsString()
  @Length(0, 5000)
  content!: string;
}

export class QuestionInputDto {
  @IsString()
  subjectId!: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(12)
  grade?: number;

  @IsOptional()
  @IsEnum(Semester)
  semester?: Semester;

  @IsEnum(QuestionType)
  questionType!: QuestionType;

  @IsString()
  @Length(1, 30000)
  stem!: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => QuestionOptionDto)
  options?: QuestionOptionDto[];

  @IsOptional()
  @IsString()
  @Length(0, 10000)
  correctAnswer?: string;

  @IsOptional()
  @IsString()
  @Length(0, 10000)
  studentAnswer?: string;

  @IsOptional()
  @IsString()
  @Length(0, 30000)
  analysis?: string;

  @IsOptional()
  @IsString()
  @Length(0, 5000)
  errorReason?: string;

  @IsOptional()
  @IsString()
  @Length(0, 5000)
  note?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5)
  difficulty?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(5)
  mastery?: number;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @ArrayMaxSize(8)
  knowledgePoints?: string[];

  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  @ArrayMaxSize(9)
  sourceImageIds?: string[];

  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  @ArrayMaxSize(3)
  figureImageIds?: string[];

  @IsOptional()
  @IsEnum(QuestionSource)
  source?: QuestionSource;

  @IsOptional()
  @IsUUID()
  sourceJobId?: string;
}

export class CreateQuestionDto extends QuestionInputDto {
  @IsUUID()
  studentId!: string;
}

export class BatchCreateQuestionsDto {
  @IsUUID()
  studentId!: string;

  @IsOptional()
  @IsUUID()
  sourceJobId?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => QuestionInputDto)
  questions!: QuestionInputDto[];
}

export class UpdateQuestionDto {
  @IsOptional()
  @IsString()
  subjectId?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(12)
  grade?: number;

  @IsOptional()
  @IsEnum(Semester)
  semester?: Semester;

  @IsOptional()
  @IsEnum(QuestionType)
  questionType?: QuestionType;

  @IsOptional()
  @IsString()
  @Length(1, 30000)
  stem?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => QuestionOptionDto)
  options?: QuestionOptionDto[];

  @IsOptional()
  @IsString()
  @Length(0, 10000)
  correctAnswer?: string;

  @IsOptional()
  @IsString()
  @Length(0, 10000)
  studentAnswer?: string;

  @IsOptional()
  @IsString()
  @Length(0, 30000)
  analysis?: string;

  @IsOptional()
  @IsString()
  @Length(0, 5000)
  errorReason?: string;

  @IsOptional()
  @IsString()
  @Length(0, 5000)
  note?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5)
  difficulty?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(5)
  mastery?: number;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @ArrayMaxSize(8)
  knowledgePoints?: string[];

  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  @ArrayMaxSize(9)
  sourceImageIds?: string[];

  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  @ArrayMaxSize(3)
  figureImageIds?: string[];
}

export class QueryQuestionsDto {
  @IsOptional()
  @IsUUID()
  studentId?: string;

  @IsOptional()
  @IsString()
  subjectId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(12)
  grade?: number;

  @IsOptional()
  @IsEnum(Semester)
  semester?: Semester;

  @IsOptional()
  @IsUUID()
  knowledgePointId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(5)
  masteryMin?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(5)
  masteryMax?: number;

  @IsOptional()
  @IsEnum(QuestionType)
  questionType?: QuestionType;

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
  @IsEnum(QuestionStatus)
  status?: QuestionStatus;

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

  @IsOptional()
  @IsIn(['createdAt', 'updatedAt', 'mastery', 'difficulty'])
  sortBy?: string;

  @IsOptional()
  @IsIn(['asc', 'desc'])
  sortOrder?: 'asc' | 'desc';
}

export class BatchQuestionActionDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @IsUUID('4', { each: true })
  ids!: string[];

  @IsIn(['archive', 'activate', 'delete'])
  action!: 'archive' | 'activate' | 'delete';
}
