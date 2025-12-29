import { Processor, Process } from '@nestjs/bull';
import { Job } from 'bull';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Plan, PlanContent } from '../entities/plan.entity';
import { Goal } from '../../goals/entities/goal.entity';
import { OpenAIService } from '../../openai/openai.service';
import { PlanGenerationJob } from '../plans.service';
import { PlanResponse } from '../../openai/dto/plan-response.dto';

@Processor('plan-generation')
export class PlanGenerationProcessor {
  constructor(
    @InjectRepository(Plan)
    private plansRepository: Repository<Plan>,
    @InjectRepository(Goal)
    private goalsRepository: Repository<Goal>,
    private openAIService: OpenAIService,
  ) {}

  @Process('generate')
  async handlePlanGeneration(job: Job<PlanGenerationJob>) {
    const { goalId, title, context, constraints } = job.data;

    try {
      // Update progress
      await job.progress(10);

      // Generate plan using OpenAI
      const planResponse = await this.openAIService.generatePlan({
        goalDescription: title,
        contextDescription: context,
      });

      await job.progress(80);

      // Save plan to database
      const goal = await this.goalsRepository.findOne({
        where: { id: goalId },
      });

      if (!goal) {
        throw new Error('Goal not found');
      }

      // Преобразуем PlanResponse в PlanContent для сохранения
      const planContent: PlanContent = {
        days: [],
        meta: {
          total_days: planResponse.days_count,
          avg_daily_duration: 0,
        },
      };

      const plan = this.plansRepository.create({
        goalId,
        generatedBy: 'gpt-4',
        content: planContent,
        snapshotVersion: 1,
      });

      const savedPlan = await this.plansRepository.save(plan);

      // Update goal with plan_id
      goal.planId = savedPlan.id;
      await this.goalsRepository.save(goal);

      await job.progress(100);

      return { planId: savedPlan.id };
    } catch (error) {
      console.error('Plan generation error:', error);
      throw error;
    }
  }
}

