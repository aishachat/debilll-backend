import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { addDays, isWeekend, parseISO, format } from 'date-fns';
import { Goal } from './entities/goal.entity';
import { Strategy } from './entities/strategy.entity';
import { Task, TaskPriority, TaskStatus, TaskCreatedBy } from '../tasks/entities/task.entity';
import { Message, MessageRole } from '../messages/entities/message.entity';
import { OpenAIService } from '../openai/openai.service';
import { PlanResponse } from '../openai/dto/plan-response.dto';
import { CreatePlanDto } from './dto/create-plan.dto';

@Injectable()
export class GoalsPlanService {
  private readonly logger = new Logger(GoalsPlanService.name);

  constructor(
    @InjectRepository(Goal)
    private goalsRepository: Repository<Goal>,
    @InjectRepository(Strategy)
    private strategiesRepository: Repository<Strategy>,
    @InjectRepository(Task)
    private tasksRepository: Repository<Task>,
    @InjectRepository(Message)
    private messagesRepository: Repository<Message>,
    private openAIService: OpenAIService,
  ) {}

  /**
   * Вычисляет дату для задачи на основе day_index, targetDate и skipWeekends
   */
  private calculateTaskDate(
    dayIndex: number,
    startDate: Date,
    targetDate?: string,
    skipWeekends: boolean = false,
  ): Date {
    if (!targetDate) {
      // Если нет targetDate, просто добавляем day_index к startDate
      const taskDate = new Date(startDate);
      taskDate.setDate(startDate.getDate() + (dayIndex - 1));
      return taskDate;
    }

    // Вычисляем все рабочие дни от startDate до targetDate
    const target = parseISO(targetDate);
    target.setHours(23, 59, 59, 999);
    const workingDays: Date[] = [];
    let currentDate = new Date(startDate);

    while (currentDate <= target && workingDays.length < dayIndex) {
      if (!skipWeekends || !isWeekend(currentDate)) {
        workingDays.push(new Date(currentDate));
      }
      currentDate = addDays(currentDate, 1);
    }

    // Если day_index больше количества рабочих дней, используем последний рабочий день
    if (dayIndex > workingDays.length) {
      return workingDays[workingDays.length - 1] || startDate;
    }

    return workingDays[dayIndex - 1] || startDate;
  }

  /**
   * Создание плана на основе цели и контекста
   */
  async createPlan(userId: string, createPlanDto: CreatePlanDto) {
    const { goal_id: goalId, goal_description: goalDescription, context_description: contextDescription, target_date: targetDate } = createPlanDto;

    // Проверяем, что цель существует
    // Проверяем, является ли goalId валидным UUID
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const isTemporaryGoal = !uuidRegex.test(goalId); // Если не UUID, значит временная цель
    
    this.logger.log(`Goal ID: ${goalId}, isTemporary: ${isTemporaryGoal}, isValidUUID: ${uuidRegex.test(goalId)}`);
    
    let goal;
    if (isTemporaryGoal) {
      // Для временных целей (не UUID) создаем объект без сохранения в БД
      this.logger.warn(`Temporary goal ID detected: ${goalId}, skipping DB operations`);
      goal = {
        id: goalId,
        userId,
        title: goalDescription,
        context: contextDescription,
        plan: null,
      } as any;
    } else {
      // Для валидных UUID ищем цель в БД или создаем новую
      goal = await this.goalsRepository.findOne({
        where: { id: goalId },
        relations: [], // Не загружаем relations для производительности
      });

      if (!goal) {
        // Проверяем, является ли userId валидным UUID
        const userIdIsUUID = uuidRegex.test(userId);
        
        if (userIdIsUUID) {
          // Если userId валидный UUID, создаем цель в БД
          this.logger.log(`Goal not found, creating new goal with ID: ${goalId}`);
          goal = this.goalsRepository.create({
            id: goalId, // Используем UUID с фронтенда
            userId,
            title: goalDescription,
            context: contextDescription,
          });
          await this.goalsRepository.save(goal);
        } else {
          // Если userId не валидный UUID (например, "default-user-id"), не сохраняем в БД
          this.logger.warn(`UserId ${userId} is not a valid UUID, skipping DB save`);
          goal = {
            id: goalId,
            userId,
            title: goalDescription,
            context: contextDescription,
            plan: null,
          } as any;
        }
      } else {
        // Обновляем существующую цель
        goal.title = goalDescription;
        goal.context = contextDescription;
        await this.goalsRepository.save(goal);
      }
    }

    try {
      this.logger.log(`Creating plan for goal ${goalId}, isTemporary: ${isTemporaryGoal}`);
      
      // Генерируем план через OpenAI
      let planResponse: PlanResponse;
      try {
        const startTime = Date.now();
        this.logger.log('Calling OpenAI to generate plan...');
        planResponse = await this.openAIService.generatePlan({
          goalDescription,
          contextDescription,
          targetDate: targetDate,
        });
        const openaiTime = Date.now() - startTime;
        this.logger.log(`Plan generated successfully in ${openaiTime}ms`);
      } catch (openaiError: any) {
        this.logger.error('OpenAI error:', openaiError);
        // Если ошибка OpenAI (например, 403 - регион не поддерживается)
        if (openaiError?.message?.includes('403') || openaiError?.message?.includes('Country, region')) {
          throw new BadRequestException('OpenAI API недоступен в вашем регионе. Пожалуйста, используйте VPN или обратитесь к администратору.');
        }
        throw openaiError;
      }

      // Для временных целей не сохраняем в БД, только возвращаем данные
      let strategies, tasks;
      
      if (isTemporaryGoal) {
        // Создаем объекты без сохранения в БД
        strategies = planResponse.strategy.map((item, index) => ({
          id: `temp-strategy-${index}`,
          goalId,
          title: item.title,
          description: item.description,
          orderIndex: index,
        }));

        // Вычисляем даты для задач
        const startDate = new Date();
        startDate.setHours(0, 0, 0, 0);
        
        // Для MVP используем дефолтное значение skipWeekends = false
        const skipWeekends = false;

        tasks = planResponse.tasks.map((planTask, index) => {
          const taskDate = this.calculateTaskDate(
            planTask.day_index,
            startDate,
            targetDate,
            skipWeekends,
          );

          return {
            id: `temp-task-${index}`,
            goalId,
            planId: null,
            date: format(taskDate, 'yyyy-MM-dd'),
            dayIndex: planTask.day_index,
            title: planTask.title,
            description: planTask.description,
            priority: planTask.priority,
            status: 'todo',
            createdBy: 'ai',
            manuallyAdded: false,
          };
        });
      } else {
        // Для реальных целей сохраняем в БД
        try {
          // Для MVP используем дефолтное значение skipWeekends = false
          // В будущем можно добавить поле settings в Goal entity
          const skipWeekends = false;
          
          strategies = await this.saveStrategies(goalId, planResponse.strategy);
          tasks = await this.saveTasks(goalId, planResponse.tasks, targetDate, skipWeekends);
          
          // Пропускаем сохранение сообщений и генерацию сводки для ускорения процесса
          // await this.saveChatMessages(goalId, userId, goalDescription, contextDescription, planResponse);
          // const planSummary = await this.openAIService.generatePlanSummary(planResponse);
          // const summaryMessage = this.messagesRepository.create({
          //   goalId,
          //   userId,
          //   role: MessageRole.ASSISTANT,
          //   content: planSummary,
          // });
          // await this.messagesRepository.save(summaryMessage);
        } catch (dbError: any) {
          this.logger.error('Error saving to database:', dbError);
          // Если ошибка при сохранении в БД, создаем объекты без сохранения
          strategies = planResponse.strategy.map((item, index) => ({
            id: `temp-strategy-${index}`,
            goalId,
            title: item.title,
            description: item.description,
            orderIndex: index,
          }));

          const startDate = new Date();
          startDate.setHours(0, 0, 0, 0);
          // Для MVP используем дефолтное значение skipWeekends = false
          const skipWeekends = false;
          
          tasks = planResponse.tasks.map((planTask, index) => {
            const taskDate = this.calculateTaskDate(
              planTask.day_index,
              startDate,
              targetDate,
              skipWeekends,
            );
            
            return {
              id: `temp-task-${index}`,
              goalId,
              planId: null,
              date: taskDate,
              dayIndex: planTask.day_index,
              title: planTask.title,
              description: planTask.description,
              priority: planTask.priority as TaskPriority,
              status: TaskStatus.TODO,
              createdBy: TaskCreatedBy.AI,
              manuallyAdded: false,
            };
          });
        }
      }

      // Форматируем ответ в правильном формате
      this.logger.log('Formatting response...');
      
      const formattedStrategies = strategies.map((s: any) => ({
        id: s.id || `temp-strategy-${Date.now()}-${Math.random()}`,
        title: s.title,
        description: s.description,
      }));

      const formattedTasks = tasks.map((t: any) => ({
        id: t.id || `temp-task-${Date.now()}-${Math.random()}`,
        title: t.title,
        description: t.description || '',
        priority: t.priority,
        day_index: t.dayIndex || t.day_index || 1,
        date: typeof t.date === 'string' ? t.date : (t.date?.toISOString().split('T')[0] || new Date().toISOString().split('T')[0]),
      }));

      this.logger.log(`Returning plan with ${formattedStrategies.length} strategies and ${formattedTasks.length} tasks`);
      this.logger.log(`Tasks sample: ${JSON.stringify(formattedTasks.slice(0, 2))}`);

      const response = {
        success: true,
        data: {
          goal: {
            id: goal.id,
            title: goal.title,
            context: goal.context,
          },
          plan: {
            strategy: formattedStrategies,
            tasks: formattedTasks,
            daysCount: planResponse.days_count,
          },
        },
      };
      
      this.logger.log(`Response structure: ${JSON.stringify({ 
        success: response.success, 
        hasData: !!response.data,
        hasPlan: !!response.data.plan,
        tasksCount: response.data.plan.tasks.length 
      })}`);
      
      return response;
    } catch (error: any) {
      this.logger.error(`Failed to create plan for goal ${goalId}:`, error);
      this.logger.error('Error details:', error.stack);
      throw new BadRequestException(
        error?.message || `Failed to generate plan: ${error?.message || 'Unknown error'}`,
      );
    }
  }

  /**
   * Сохранение стратегии
   */
  private async saveStrategies(goalId: string, strategyItems: PlanResponse['strategy']) {
    // Проверяем, что goalId - валидный UUID
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(goalId)) {
      this.logger.warn(`Skipping saveStrategies for non-UUID goalId: ${goalId}`);
      // Возвращаем объекты без сохранения
      return strategyItems.map((item, index) => ({
        id: `temp-strategy-${index}`,
        goalId,
        title: item.title,
        description: item.description,
        orderIndex: index,
      }));
    }

    // Удаляем старую стратегию, если есть
    await this.strategiesRepository.delete({ goalId });

    const strategies = strategyItems.map((item, index) =>
      this.strategiesRepository.create({
        goalId,
        title: item.title,
        description: item.description,
        orderIndex: index,
      }),
    );

    return this.strategiesRepository.save(strategies);
  }

  /**
   * Сохранение задач
   */
  private async saveTasks(
    goalId: string,
    planTasks: PlanResponse['tasks'],
    targetDate?: string,
    skipWeekends: boolean = false,
  ) {
    // Проверяем, что goalId - валидный UUID
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(goalId)) {
      this.logger.warn(`Skipping saveTasks for non-UUID goalId: ${goalId}`);
      // Возвращаем объекты без сохранения
      const startDate = new Date();
      startDate.setHours(0, 0, 0, 0);
      return planTasks.map((planTask, index) => {
        const taskDate = this.calculateTaskDate(
          planTask.day_index,
          startDate,
          targetDate,
          skipWeekends,
        );
        return {
          id: `temp-task-${index}`,
          goalId,
          planId: null,
          date: taskDate,
          dayIndex: planTask.day_index,
          title: planTask.title,
          description: planTask.description,
          priority: planTask.priority as TaskPriority,
          status: TaskStatus.TODO,
          createdBy: TaskCreatedBy.AI,
          manuallyAdded: false,
        };
      });
    }

    // Удаляем старые задачи, созданные ИИ (не вручную добавленные)
    await this.tasksRepository.delete({
      goalId,
      manuallyAdded: false,
    });

    // Вычисляем даты для каждого дня
    const startDate = new Date();
    startDate.setHours(0, 0, 0, 0);

    const tasks = planTasks.map((planTask) => {
      // Вычисляем дату на основе day_index с учетом targetDate и skipWeekends
      const taskDate = this.calculateTaskDate(
        planTask.day_index,
        startDate,
        targetDate,
        skipWeekends,
      );

      return this.tasksRepository.create({
        goalId,
        planId: null, // Пока не используем plan_id
        date: taskDate,
        dayIndex: planTask.day_index,
        title: planTask.title,
        description: planTask.description,
        priority: planTask.priority as TaskPriority,
        status: TaskStatus.TODO,
        createdBy: TaskCreatedBy.AI,
        manuallyAdded: false,
      });
    });

    return this.tasksRepository.save(tasks);
  }

  /**
   * Сохранение сообщений в чат
   */
  private async saveChatMessages(
    goalId: string,
    userId: string,
    goalDescription: string,
    contextDescription: string,
    planResponse: PlanResponse,
  ) {
    // Сохраняем первое сообщение пользователя (цель)
    const goalMessage = this.messagesRepository.create({
      goalId,
      userId,
      role: MessageRole.USER,
      content: goalDescription,
    });
    await this.messagesRepository.save(goalMessage);

    // Сохраняем второе сообщение пользователя (контекст)
    const contextMessage = this.messagesRepository.create({
      goalId,
      userId,
      role: MessageRole.USER,
      content: contextDescription,
    });
    await this.messagesRepository.save(contextMessage);
  }

  /**
   * Получение плана цели
   */
  async getPlan(goalId: string, userId: string) {
    const goal = await this.goalsRepository.findOne({
      where: { id: goalId, userId },
      relations: ['strategies', 'tasks'],
    });

    if (!goal) {
      throw new NotFoundException('Goal not found');
    }

    // Сортируем задачи по дням и приоритету
    const sortedTasks = goal.tasks
      .filter((t) => !t.manuallyAdded || t.dayIndex !== null)
      .sort((a, b) => {
        // Сначала по дню
        const dayA = a.dayIndex || 0;
        const dayB = b.dayIndex || 0;
        if (dayA !== dayB) {
          return dayA - dayB;
        }

        // Затем по приоритету
        const priorityOrder = { high: 3, medium: 2, low: 1 };
        return priorityOrder[b.priority] - priorityOrder[a.priority];
      });

    return {
      success: true,
      data: {
        goal: {
          id: goal.id,
          title: goal.title,
          context: goal.context,
        },
        strategy: goal.strategies.sort((a, b) => a.orderIndex - b.orderIndex),
        tasks: sortedTasks,
        daysCount: Math.max(...sortedTasks.map((t) => t.dayIndex || 0), 0),
      },
    };
  }
}

