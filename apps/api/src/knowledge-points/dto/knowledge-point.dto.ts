import { Type } from 'class-transformer';
import {
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Max,
  Min,
} from 'class-validator';

export class CreateKnowledgePointDto {
  @IsString()
  subjectId!: string;

  @IsString()
  @Length(1, 40)
  name!: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  aliases?: string[];

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(12)
  gradeMin?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(12)
  gradeMax?: number;
}

export class UpdateKnowledgePointDto {
  @IsOptional()
  @IsString()
  @Length(1, 40)
  name?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  aliases?: string[];

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(12)
  gradeMin?: number | null;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(12)
  gradeMax?: number | null;
}

export class MergeKnowledgePointDto {
  @IsUUID()
  targetId!: string;
}

export class QueryKnowledgePointDto {
  @IsOptional()
  @IsString()
  subjectId?: string;

  @IsOptional()
  @IsString()
  q?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(12)
  grade?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}
