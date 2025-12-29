import { IsString, IsNotEmpty, IsOptional } from 'class-validator';

export class CreatePlanDto {
  @IsString()
  @IsNotEmpty()
  goal_id: string; // Может быть UUID или временный ID (goal_... или temp-...)

  @IsString()
  @IsNotEmpty()
  goal_description: string;

  @IsString()
  @IsNotEmpty()
  context_description: string;

  @IsString()
  @IsOptional()
  target_date?: string; // Дата окончания цели в формате YYYY-MM-DD

  @IsString()
  @IsOptional()
  user_id?: string; // ID пользователя из Supabase (опционально, для обратной совместимости)
}

