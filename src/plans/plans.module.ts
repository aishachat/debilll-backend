import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bull';
import { PlansController } from './plans.controller';
import { PlansService } from './plans.service';
import { Plan } from './entities/plan.entity';
import { Goal } from '../goals/entities/goal.entity';
import { PlanGenerationProcessor } from './processors/plan-generation.processor';
import { OpenAIModule } from '../openai/openai.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Plan, Goal]),
    BullModule.registerQueue({
      name: 'plan-generation',
    }),
    OpenAIModule,
  ],
  controllers: [PlansController],
  providers: [PlansService, PlanGenerationProcessor],
  exports: [PlansService],
})
export class PlansModule {}

