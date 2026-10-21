import { IsIn, IsInt, IsOptional, IsString, Length, Matches, Max, Min } from 'class-validator';

export class RegisterDto {
  @IsString()
  @Length(3, 32, { message: '账号长度需为 3-32 位' })
  @Matches(/^[a-zA-Z0-9_]+$/, { message: '账号只能包含字母、数字和下划线' })
  username!: string;

  @IsString()
  @Length(8, 64, { message: '密码长度需为 8-64 位' })
  password!: string;

  @IsOptional()
  @IsString()
  @Length(1, 30)
  displayName?: string;

  @IsOptional()
  @IsString()
  @Length(1, 30)
  studentName?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(12)
  grade?: number;

  @IsOptional()
  @IsIn(['FIRST', 'SECOND'])
  semester?: 'FIRST' | 'SECOND';

  @IsOptional()
  @IsString()
  inviteCode?: string;
}
