import { Controller, Post, Get, Param, Body, UseGuards } from '@nestjs/common';
import { GoalsPlanService } from './goals-plan.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Public } from '../auth/decorators/public.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { CreatePlanDto } from './dto/create-plan.dto';

@Controller('goals')
@UseGuards(JwtAuthGuard)
export class GoalsPlanController {
  constructor(private readonly goalsPlanService: GoalsPlanService) {}

  @Post('create-plan')
  @Public() // Временно публичный endpoint для MVP
  async createPlan(
    @Body() createPlanDto: CreatePlanDto,
  ) {
    console.log('[Controller] create-plan request received');
    console.log('[Controller] Goal:', createPlanDto.goal_description?.substring(0, 50));
    console.log('[Controller] Target date:', createPlanDto.target_date);
    console.log('[Controller] User ID:', createPlanDto.user_id || 'not provided');
    
    // Используем переданный userId или дефолтный для обратной совместимости
    const userId = createPlanDto.user_id || 'default-user-id';
    
    try {
      const result = await this.goalsPlanService.createPlan(userId, createPlanDto);
      console.log('[Controller] create-plan completed successfully');
      return result;
    } catch (error: any) {
      console.error('[Controller] create-plan error:', error?.message || 'Unknown error');
      throw error;
    }
  }

  @Get(':goalId/plan')
  async getPlan(
    @Param('goalId') goalId: string,
    @CurrentUser() user: any,
  ) {
    return this.goalsPlanService.getPlan(goalId, user.userId);
  }
}

