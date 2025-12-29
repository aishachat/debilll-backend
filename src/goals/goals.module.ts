import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GoalsController } from './goals.controller';
import { GoalsService } from './goals.service';
import { GoalsPlanController } from './goals-plan.controller';
import { GoalsPlanService } from './goals-plan.service';
import { Goal } from './entities/goal.entity';
import { Strategy } from './entities/strategy.entity';
import { User } from '../users/entities/user.entity';
import { Task } from '../tasks/entities/task.entity';
import { Message } from '../messages/entities/message.entity';
import { PlansModule } from '../plans/plans.module';
import { OpenAIModule } from '../openai/openai.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Goal, Strategy, User, Task, Message]),
    PlansModule,
    OpenAIModule,
  ],
  controllers: [GoalsController, GoalsPlanController],
  providers: [GoalsService, GoalsPlanService],
  exports: [GoalsService, GoalsPlanService],
})
export class GoalsModule {}

