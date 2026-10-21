import { IsEnum, IsInt, IsOptional, IsString, Length, Max, Min } from 'class-validator';
import { Semester } from '@prisma/client';

export class CreateStudentDto {
  @IsString()
  @Length(1, 30, { message: '孩子昵称需为 1-30 个字符' })
  name!: string;

  @IsInt()
  @Min(1)
  @Max(12)
  grade!: number;

  @IsOptional()
  @IsEnum(Semester)
  semester?: Semester;

  @IsOptional()
  @IsString()
  avatarUrl?: string;
}

export class UpdateStudentDto {
  @IsOptional()
  @IsString()
  @Length(1, 30)
  name?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(12)
  grade?: number;

  @IsOptional()
  @IsEnum(Semester)
  semester?: Semester;

  @IsOptional()
  @IsString()
  avatarUrl?: string | null;
}
