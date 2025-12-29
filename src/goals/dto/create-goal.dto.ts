import { IsString, IsNotEmpty, IsOptional, IsBoolean } from 'class-validator';

export class CreateGoalDto {
  @IsString()
  @IsNotEmpty()
  title: string;

  @IsString()
  @IsNotEmpty()
  context: string;

  @IsOptional()
  @IsBoolean()
  generatePlan?: boolean;
}

