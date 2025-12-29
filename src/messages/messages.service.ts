import { Injectable, NotFoundException, ForbiddenException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Message, MessageRole } from './entities/message.entity';
import { Goal } from '../goals/entities/goal.entity';
import { Task, TaskStatus } from '../tasks/entities/task.entity';
import { User, SubscriptionTier } from '../users/entities/user.entity';
import { OpenAIService } from '../openai/openai.service';
import { Response } from 'express';

@Injectable()
export class MessagesService {
  private readonly logger = new Logger(MessagesService.name);

  constructor(
    @InjectRepository(Message)
    private messagesRepository: Repository<Message>,
    @InjectRepository(Goal)
    private goalsRepository: Repository<Goal>,
    @InjectRepository(Task)
    private tasksRepository: Repository<Task>,
    private openAIService: OpenAIService,
  ) {}

  async findAll(goalId: string, userId: string) {
    const goal = await this.goalsRepository.findOne({
      where: { id: goalId, userId },
    });

    if (!goal) {
      throw new NotFoundException('Goal not found');
    }

    const messages = await this.messagesRepository.find({
      where: { goalId },
      order: { createdAt: 'ASC' },
    });

    return {
      success: true,
      data: messages,
    };
  }

  async sendMessage(
    goalId: string,
    userId: string,
    content: string,
    taskId?: string,
    taskTitle?: string,
    taskDescription?: string,
  ) {
    // Проверяем, является ли userId валидным UUID
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const isTemporaryUserId = !uuidRegex.test(userId);
    // Для MVP: если goalId начинается с 'temp-' или 'goal_', или userId не валидный UUID, это временная цель
    const isTemporaryGoal = goalId.startsWith('temp-') || goalId.startsWith('goal_') || isTemporaryUserId;
    
    let goal;
    if (isTemporaryGoal) {
      // Для временных целей создаем объект цели из данных, которые пришли при создании плана
      // Или используем дефолтные значения
      goal = {
        id: goalId,
        userId,
        title: 'Временная цель',
        context: '',
        plan: null,
      } as any;
    } else {
      goal = await this.goalsRepository.findOne({
        where: { id: goalId, userId },
        relations: ['plan'],
      });

      if (!goal) {
        throw new NotFoundException('Goal not found');
      }
    }

    // Check free tier restriction for task discussion (только для реальных пользователей)
    if (taskId && !isTemporaryUserId) {
      try {
        const user = await this.goalsRepository.manager
          .getRepository('users')
          .findOne({ where: { id: userId } });

        if (user?.subscriptionTier === SubscriptionTier.FREE) {
          throw new ForbiddenException({
            code: 'FEATURE_LOCKED',
            message: 'Task discussion is available only for Pro users',
          });
        }
      } catch (error: any) {
        // Если ошибка связана с UUID или БД, игнорируем для временных пользователей
        if (error?.message?.includes('uuid') || error?.message?.includes('invalid input')) {
          // Для временных пользователей разрешаем обсуждение задач
          this.logger.warn('Skipping subscription check for temporary user');
        } else {
          throw error;
        }
      }
    }

    // Save user message (только для реальных целей с UUID)
    let userMessage;
    let history: any[] = [];
    
    if (!isTemporaryGoal) {
      userMessage = this.messagesRepository.create({
        goalId,
        userId,
        taskId: taskId || null,
        role: MessageRole.USER,
        content,
      });
      await this.messagesRepository.save(userMessage);

      // Get chat history
      history = await this.messagesRepository.find({
        where: { goalId },
        order: { createdAt: 'ASC' },
        take: 20, // Last 20 messages
      });
    } else {
      // Для временных целей создаем объект сообщения без сохранения
      userMessage = {
        id: 'temp-' + Date.now(),
        goalId,
        userId,
        taskId: taskId || null,
        role: MessageRole.USER,
        content,
        createdAt: new Date(),
      };
      // История пустая для временных целей
      history = [];
    }

    // Get task context if taskId provided
    let taskContext = null;
    if (taskId) {
      // Проверяем, является ли это временной задачей (не сохраняется в БД)
      const isTemporaryTask = taskId.startsWith('temp-task-') || taskId.startsWith('temp-');
      
      if (isTemporaryTask) {
        // Для временных задач не ищем в БД, просто пропускаем taskContext
        // OpenAI получит информацию о задаче из сообщения пользователя
        taskContext = null;
      } else {
        // Для реальных задач ищем в БД
        const task = await this.tasksRepository.findOne({
          where: { id: taskId },
        });
        if (task) {
          taskContext = {
            id: task.id,
            title: task.title,
            description: task.description,
            date: task.date,
            priority: task.priority,
          };
        }
      }
    }

    // Get completed tasks for context (только для реальных целей)
    let completedTasks: any[] = [];
    if (!isTemporaryGoal) {
      completedTasks = await this.tasksRepository.find({
        where: { goalId, status: TaskStatus.DONE },
        order: { date: 'ASC' },
        take: 50, // Последние 50 выполненных задач
      });
    }

    // Generate AI response
    let aiResponse: string;
    try {
      this.logger.log('Calling OpenAI generateChatResponse');
      const startTime = Date.now();
      aiResponse = await this.openAIService.generateChatResponse({
        goal,
        history,
        userMessage: content,
        taskContext,
        completedTasks,
      });
      const duration = Date.now() - startTime;
      this.logger.log(`OpenAI generateChatResponse completed in ${duration}ms`);
    } catch (error: any) {
      this.logger.error('Error in generateChatResponse:', error?.message);
      // Если ошибка OpenAI, возвращаем понятное сообщение
      if (error?.message?.includes('403') || error?.message?.includes('Country, region')) {
        aiResponse = 'Извините, OpenAI API недоступен в вашем регионе. Пожалуйста, используйте VPN или обратитесь к администратору.';
      } else if (error?.message?.includes('timeout')) {
        aiResponse = 'Извините, запрос к OpenAI занял слишком много времени. Попробуйте позже.';
      } else {
        aiResponse = 'Извините, произошла ошибка при генерации ответа. Попробуйте позже.';
      }
    }

    // Save AI message (только для реальных целей с UUID)
    let assistantMessage;
    
    if (!isTemporaryGoal) {
      assistantMessage = this.messagesRepository.create({
        goalId,
        userId,
        taskId: taskId || null,
        role: MessageRole.ASSISTANT,
        content: aiResponse,
      });
      await this.messagesRepository.save(assistantMessage);
    } else {
      // Для временных целей создаем объект без сохранения
      assistantMessage = {
        id: 'temp-' + Date.now() + '-assistant',
        goalId,
        userId,
        taskId: taskId || null,
        role: MessageRole.ASSISTANT,
        content: aiResponse,
        createdAt: new Date(),
      };
    }

    return {
      success: true,
      data: {
        userMessage,
        assistantMessage,
      },
    };
  }

  /**
   * Отправка сообщения со streaming ответом
   */
  async sendMessageStream(
    goalId: string,
    userId: string,
    content: string,
    taskId: string | undefined,
    res: Response,
    taskTitle?: string,
    taskDescription?: string,
  ) {
    // Проверяем, является ли userId валидным UUID
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const isTemporaryUserId = !uuidRegex.test(userId);
    const isTemporaryGoal = goalId.startsWith('temp-') || goalId.startsWith('goal_') || isTemporaryUserId;
    
    let goal;
    if (isTemporaryGoal) {
      goal = {
        id: goalId,
        userId,
        title: 'Временная цель',
        context: '',
        plan: null,
      } as any;
    } else {
      goal = await this.goalsRepository.findOne({
        where: { id: goalId, userId },
        relations: ['plan'],
      });

      if (!goal) {
        res.status(404).json({ error: 'Goal not found' });
        return;
      }
    }

    // Get task context if taskId provided
    let taskContext = null;
    if (taskId) {
      // Проверяем, является ли это временной задачей (не сохраняется в БД)
      const isTemporaryTask = taskId.startsWith('temp-task-') || taskId.startsWith('temp-');
      
      if (isTemporaryTask) {
        // Для временных задач используем информацию, переданную с фронтенда
        if (taskTitle) {
          taskContext = {
            id: taskId,
            title: taskTitle,
            description: taskDescription || '',
            date: null,
            priority: null,
          };
        }
      } else {
        // Для реальных задач ищем в БД
        const task = await this.tasksRepository.findOne({
          where: { id: taskId },
        });
        if (task) {
          taskContext = {
            id: task.id,
            title: task.title,
            description: task.description,
            date: task.date,
            priority: task.priority,
          };
        }
      }
    }

    // Get completed tasks for context (только для реальных целей)
    let completedTasks: any[] = [];
    if (!isTemporaryGoal) {
      completedTasks = await this.tasksRepository.find({
        where: { goalId, status: TaskStatus.DONE },
        order: { date: 'ASC' },
        take: 50, // Последние 50 выполненных задач
      });
    }

    // Get chat history (только для реальных целей)
    let history: any[] = [];
    if (!isTemporaryGoal) {
      history = await this.messagesRepository.find({
        where: { goalId },
        order: { createdAt: 'ASC' },
        take: 20,
      });
    }

    // Настраиваем SSE
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no'); // Отключаем буферизацию в nginx

    let fullResponse = '';
    let headersSent = false;

    try {
      // Генерируем streaming ответ
      for await (const chunk of this.openAIService.generateChatResponseStream({
        goal,
        history,
        userMessage: content,
        taskContext,
        completedTasks,
      })) {
        fullResponse += chunk;
        // Отправляем chunk клиенту
        try {
          res.write(`data: ${JSON.stringify({ chunk, done: false })}\n\n`);
          headersSent = true;
        } catch (writeError) {
          // Если запись не удалась, прерываем цикл
          this.logger.error('Error writing chunk to response:', writeError);
          break;
        }
      }

      // Сохраняем сообщения в БД (только для реальных целей с UUID)
      if (!isTemporaryGoal) {
        try {
          // Сохраняем сообщение пользователя
          const userMessage = this.messagesRepository.create({
            goalId,
            userId,
            taskId: taskId || null,
            role: MessageRole.USER,
            content,
          });
          await this.messagesRepository.save(userMessage);

          // Сохраняем ответ ассистента
          const assistantMessage = this.messagesRepository.create({
            goalId,
            userId,
            taskId: taskId || null,
            role: MessageRole.ASSISTANT,
            content: fullResponse,
          });
          await this.messagesRepository.save(assistantMessage);
        } catch (saveError) {
          // Логируем ошибку, но не прерываем ответ
          this.logger.error('Error saving messages to database:', saveError);
        }
      }

      // Отправляем финальное сообщение
      if (!res.headersSent || headersSent) {
        try {
          res.write(`data: ${JSON.stringify({ chunk: '', done: true, fullText: fullResponse })}\n\n`);
          res.end();
        } catch (endError) {
          this.logger.error('Error ending response:', endError);
        }
      }
    } catch (error: any) {
      const errorMessage = error?.message || 'Произошла ошибка';
      try {
        // Проверяем, что response еще не закрыт
        if (!res.headersSent || headersSent) {
          res.write(`data: ${JSON.stringify({ error: errorMessage, done: true })}\n\n`);
          res.end();
        } else {
          // Если заголовки еще не отправлены, отправляем обычный JSON ответ
          res.status(500).json({ error: errorMessage });
        }
      } catch (responseError) {
        // Если response уже закрыт, просто логируем ошибку
        this.logger.error('Error sending error response:', responseError);
        this.logger.error('Original error:', errorMessage);
      }
    }
  }
}

