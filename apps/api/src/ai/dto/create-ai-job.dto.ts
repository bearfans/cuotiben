import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';

export class CreateAiJobDto {
  @IsOptional()
  @IsUUID()
  studentId?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(9)
  @IsUUID('4', { each: true })
  uploadIds!: string[];

  @IsOptional()
  @IsString()
  subjectHint?: string;
}
