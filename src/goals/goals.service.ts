import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Goal, GoalStatus } from './entities/goal.entity';
import { User, SubscriptionTier } from '../users/entities/user.entity';
import { CreateGoalDto } from './dto/create-goal.dto';
import { PlansService } from '../plans/plans.service';

@Injectable()
export class GoalsService {
  constructor(
    @InjectRepository(Goal)
    private goalsRepository: Repository<Goal>,
    @InjectRepository(User)
    private usersRepository: Repository<User>,
    private plansService: PlansService,
  ) {}

  async findAll(userId: string) {
    const goals = await this.goalsRepository.find({
      where: { userId },
      relations: ['plan'],
      order: { createdAt: 'DESC' },
    });

    const user = await this.usersRepository.findOne({
      where: { id: userId },
    });

    return {
      success: true,
      data: goals,
      meta: {
        total: goals.length,
        limit: user?.subscriptionTier === SubscriptionTier.FREE ? 1 : null,
      },
    };
  }

  async findOne(id: string, userId: string) {
    const goal = await this.goalsRepository.findOne({
      where: { id, userId },
      relations: ['plan'],
    });

    if (!goal) {
      throw new NotFoundException('Goal not found');
    }

    return {
      success: true,
      data: goal,
    };
  }

  async create(userId: string, createGoalDto: CreateGoalDto) {
    const user = await this.usersRepository.findOne({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Check free tier limit
    if (user.subscriptionTier === SubscriptionTier.FREE) {
      const existingGoals = await this.goalsRepository.count({
        where: { userId },
      });

      if (existingGoals >= 1) {
        throw new ForbiddenException(
          'Free tier allows only 1 goal. Upgrade to Pro for unlimited goals.',
        );
      }
    }

    const goal = this.goalsRepository.create({
      userId,
      title: createGoalDto.title,
      context: createGoalDto.context,
      status: GoalStatus.ACTIVE,
      createdByAi: false,
    });

    const savedGoal = await this.goalsRepository.save(goal);

    let planJobId: string | null = null;

    // Start plan generation if requested
    if (createGoalDto.generatePlan) {
      planJobId = await this.plansService.startGeneration(
        savedGoal.id,
        userId,
        createGoalDto,
      );
    }

    return {
      success: true,
      data: {
        goal: savedGoal,
        ...(planJobId && { planJobId }),
      },
    };
  }

  async remove(id: string, userId: string) {
    const goal = await this.goalsRepository.findOne({
      where: { id, userId },
    });

    if (!goal) {
      throw new NotFoundException('Goal not found');
    }

    await this.goalsRepository.remove(goal);

    return {
      success: true,
      message: 'Goal deleted successfully',
    };
  }
}

