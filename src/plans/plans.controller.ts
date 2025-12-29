import { Controller, Get, Post, Param, Body, UseGuards } from '@nestjs/common';
import { PlansService } from './plans.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@Controller('plans')
@UseGuards(JwtAuthGuard)
export class PlansController {
  constructor(private readonly plansService: PlansService) {}

  @Get(':planId')
  async findOne(
    @Param('planId') planId: string,
    @CurrentUser() user: any,
  ) {
    return this.plansService.findOne(planId, user.userId);
  }

  @Get(':planId/status')
  async getStatus(@Param('planId') planId: string) {
    // planId here is actually jobId
    return this.plansService.getStatus(planId);
  }

  @Post('goals/:goalId/generate')
  async generate(
    @Param('goalId') goalId: string,
    @CurrentUser() user: any,
    @Body() body?: { regenerate?: boolean; constraints?: any },
  ) {
    const jobId = await this.plansService.startGeneration(
      goalId,
      user.userId,
      body || {},
    );

    return {
      success: true,
      data: { jobId },
    };
  }
}

