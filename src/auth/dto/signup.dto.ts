import { IsEmail, IsString, MinLength, IsOptional, IsIn } from 'class-validator';

export class SignupDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(8)
  password: string;

  @IsOptional()
  @IsString()
  @IsIn(['ru', 'en', 'uk'])
  lang?: string;
}

