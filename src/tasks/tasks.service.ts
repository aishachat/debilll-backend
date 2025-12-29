import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Task, TaskPriority, TaskStatus, TaskCreatedBy } from './entities/task.entity';
import { Goal } from '../goals/entities/goal.entity';
import { User, SubscriptionTier } from '../users/entities/user.entity';

@Injectable()
export class TasksService {
  constructor(
    @InjectRepository(Task)
    private tasksRepository: Repository<Task>,
    @InjectRepository(Goal)
    private goalsRepository: Repository<Goal>,
  ) {}

  async findAll(goalId: string, userId: string, date?: string) {
    const goal = await this.goalsRepository.findOne({
      where: { id: goalId, userId },
    });

    if (!goal) {
      throw new NotFoundException('Goal not found');
    }

    const query = this.tasksRepository
      .createQueryBuilder('task')
      .where('task.goalId = :goalId', { goalId });

    if (date) {
      query.andWhere('task.date = :date', { date });
    }

    const tasks = await query.orderBy('task.date', 'ASC').getMany();

    return {
      success: true,
      data: tasks,
    };
  }

  async create(
    goalId: string,
    userId: string,
    createTaskDto: {
      title: string;
      date: string;
      priority?: TaskPriority;
      description?: string;
    },
  ) {
    const goal = await this.goalsRepository.findOne({
      where: { id: goalId, userId },
    });

    if (!goal) {
      throw new NotFoundException('Goal not found');
    }

    const task = this.tasksRepository.create({
      goalId,
      planId: goal.planId,
      title: createTaskDto.title,
      date: new Date(createTaskDto.date),
      priority: createTaskDto.priority || TaskPriority.MEDIUM,
      description: createTaskDto.description || null,
      createdBy: TaskCreatedBy.USER,
      status: TaskStatus.TODO,
    });

    const saved = await this.tasksRepository.save(task);

    return {
      success: true,
      data: saved,
    };
  }

  async update(
    taskId: string,
    userId: string,
    updateDto: {
      title?: string;
      priority?: TaskPriority;
      status?: TaskStatus;
      description?: string;
    },
  ) {
    const task = await this.tasksRepository.findOne({
      where: { id: taskId },
      relations: ['goal'],
    });

    if (!task || task.goal.userId !== userId) {
      throw new NotFoundException('Task not found');
    }

    if (updateDto.title !== undefined) task.title = updateDto.title;
    if (updateDto.priority !== undefined) task.priority = updateDto.priority;
    if (updateDto.status !== undefined) task.status = updateDto.status;
    if (updateDto.description !== undefined) task.description = updateDto.description;

    const saved = await this.tasksRepository.save(task);

    return {
      success: true,
      data: saved,
    };
  }

  async remove(taskId: string, userId: string) {
    const task = await this.tasksRepository.findOne({
      where: { id: taskId },
      relations: ['goal'],
    });

    if (!task || task.goal.userId !== userId) {
      throw new NotFoundException('Task not found');
    }

    await this.tasksRepository.remove(task);

    return {
      success: true,
      message: 'Task deleted successfully',
    };
  }

  async discussTask(taskId: string, userId: string) {
    const task = await this.tasksRepository.findOne({
      where: { id: taskId },
      relations: ['goal'],
    });

    if (!task || task.goal.userId !== userId) {
      throw new NotFoundException('Task not found');
    }

    // Check free tier restriction
    const user = await this.goalsRepository.manager
      .getRepository('users')
      .findOne({ where: { id: userId } });

    if (user?.subscriptionTier === SubscriptionTier.FREE) {
      throw new ForbiddenException({
        code: 'FEATURE_LOCKED',
        message: 'Task discussion is available only for Pro users',
      });
    }

    return {
      success: true,
      data: {
        taskId: task.id,
        goalId: task.goalId,
        chatId: `chat_${task.goalId}`,
      },
    };
  }
}

