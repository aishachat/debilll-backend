import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { Plan } from './entities/plan.entity';
import { Goal } from '../goals/entities/goal.entity';
import { OpenAIService } from '../openai/openai.service';

export interface PlanGenerationJob {
  goalId: string;
  userId: string;
  title: string;
  context: string;
  constraints?: {
    no_weekends?: boolean;
    daily_time_limit_mins?: number;
  };
}

@Injectable()
export class PlansService {
  constructor(
    @InjectRepository(Plan)
    private plansRepository: Repository<Plan>,
    @InjectRepository(Goal)
    private goalsRepository: Repository<Goal>,
    @InjectQueue('plan-generation')
    private planQueue: Queue,
  ) {}

  async startGeneration(
    goalId: string,
    userId: string,
    createGoalDto: any,
  ): Promise<string> {
    const goal = await this.goalsRepository.findOne({
      where: { id: goalId, userId },
    });

    if (!goal) {
      throw new NotFoundException('Goal not found');
    }

    const user = await this.goalsRepository.manager
      .getRepository('users')
      .findOne({ where: { id: userId } });

    const constraints = {
      no_weekends: user?.settings?.weekends === false,
      daily_time_limit_mins: user?.settings?.dailyTimeLimitMins || 60,
    };

    const job = await this.planQueue.add('generate', {
      goalId,
      userId,
      title: goal.title,
      context: goal.context,
      constraints,
    });

    return job.id.toString();
  }

  async getStatus(jobId: string) {
    const job = await this.planQueue.getJob(jobId);

    if (!job) {
      throw new NotFoundException('Job not found');
    }

    const state = await job.getState();
    const progress = job.progress();

    return {
      success: true,
      data: {
        status: state,
        progress: typeof progress === 'number' ? progress : 0,
        estimated_seconds: state === 'active' ? 30 : null,
      },
    };
  }

  async findOne(planId: string, userId: string) {
    const plan = await this.plansRepository.findOne({
      where: { id: planId },
      relations: ['goal'],
    });

    if (!plan || plan.goal.userId !== userId) {
      throw new NotFoundException('Plan not found');
    }

    return {
      success: true,
      data: plan,
    };
  }

  async findByGoalId(goalId: string, userId: string) {
    const goal = await this.goalsRepository.findOne({
      where: { id: goalId, userId },
      relations: ['plan'],
    });

    if (!goal) {
      throw new NotFoundException('Goal not found');
    }

    if (!goal.plan) {
      return {
        success: true,
        data: null,
      };
    }

    return {
      success: true,
      data: goal.plan,
    };
  }
}

