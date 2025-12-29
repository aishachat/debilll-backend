import { Injectable, Logger } from '@nestjs/common';
import OpenAI from 'openai';
import { PlanResponse, StrategyItem, PlanTask } from './dto/plan-response.dto';

@Injectable()
export class OpenAIService {
  private readonly logger = new Logger(OpenAIService.name);
  private openai: OpenAI;

  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }

  /**
   * Генерация плана на основе цели и контекста
   */
  async generatePlan(params: {
    goalDescription: string;
    contextDescription: string;
    targetDate?: string;
  }): Promise<PlanResponse> {
    const systemPrompt = this.getSystemPrompt();
    const userPrompt = this.getUserPrompt(params);

    let attempts = 0;
    const maxAttempts = 3;
    let lastResponseText: string | null = null;

    while (attempts < maxAttempts) {
      try {
        const completion = await this.openai.chat.completions.create({
          model: 'gpt-4o-mini', // Используем gpt-4o-mini, который поддерживает JSON mode
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
          temperature: 0.7,
          response_format: { type: 'json_object' },
        });

        const responseText = completion.choices[0]?.message?.content;
        if (!responseText) {
          throw new Error('Empty response from OpenAI');
        }

        lastResponseText = responseText;

        // Парсим JSON (может быть обернут в markdown или содержать лишний текст)
        const cleanedJson = this.extractJson(responseText);
        const parsed = JSON.parse(cleanedJson);

        // Валидируем структуру
        const validated = this.validatePlanResponse(parsed);
        return validated;
      } catch (error: any) {
        attempts++;
        
        // Если ошибка региона, сразу выбрасываем исключение
        if (error?.status === 403 || error?.message?.includes('Country, region, or territory not supported')) {
          throw new Error('OpenAI API недоступен в вашем регионе. Пожалуйста, используйте VPN или обратитесь к администратору.');
        }
        
        this.logger.warn(`Plan generation attempt ${attempts} failed: ${error.message}`);

        if (attempts >= maxAttempts) {
          throw new Error(
            `Failed to generate valid plan after ${maxAttempts} attempts: ${error.message}`,
          );
        }

        // Retry с уточняющим prompt
        const retryPrompt = this.getRetryPrompt();
        try {
          const retryMessages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ];

          if (lastResponseText) {
            retryMessages.push({ role: 'assistant', content: lastResponseText });
          }

          retryMessages.push({ role: 'user', content: retryPrompt });

          const completion = await this.openai.chat.completions.create({
            model: 'gpt-4o-mini', // Используем gpt-4o-mini, который поддерживает JSON mode
            messages: retryMessages,
            temperature: 0.5, // Более детерминированный ответ при retry
            response_format: { type: 'json_object' },
          });

          const retryResponseText = completion.choices[0]?.message?.content;
          if (retryResponseText) {
            lastResponseText = retryResponseText;
            try {
              const cleanedJson = this.extractJson(retryResponseText);
              const parsed = JSON.parse(cleanedJson);
              const validated = this.validatePlanResponse(parsed);
              return validated;
            } catch (retryError) {
              // Продолжаем цикл
              continue;
            }
          }
        } catch (retryError) {
          // Продолжаем цикл
          continue;
        }
      }
    }

    throw new Error('Failed to generate valid plan');
  }

  /**
   * Генерация текстовой сводки плана для чата
   */
  async generatePlanSummary(planResponse: PlanResponse): Promise<string> {
    const strategyText = planResponse.strategy
      .map((s, i) => `${i + 1}. ${s.title}\n   ${s.description}`)
      .join('\n\n');

    const tasksByDay = this.groupTasksByDay(planResponse.tasks);
    const daysText = Object.entries(tasksByDay)
      .map(([day, tasks]) => {
        const tasksText = tasks
          .map((t) => `  - ${t.title} (${t.priority})`)
          .join('\n');
        return `День ${day}:\n${tasksText}`;
      })
      .join('\n\n');

    return `План готов! 

Стратегия достижения цели:
${strategyText}

Распределение задач по дням (всего ${planResponse.days_count} дней):
${daysText}

Всего задач: ${planResponse.tasks.length}`;
  }

  /**
   * Генерация ответа для чата
   */
  async generateChatResponse(params: {
    goal: any;
    history: any[];
    userMessage: string;
    taskContext?: any;
    completedTasks?: any[];
  }): Promise<string> {
    const { goal, history, userMessage, taskContext, completedTasks = [] } = params;

    const systemPrompt = taskContext
      ? this.getTaskDiscussionSystemPrompt()
      : this.getChatSystemPrompt();

    const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
      { role: 'system', content: systemPrompt },
    ];

    // Add goal context (безопасно обрабатываем undefined)
    const goalTitle = goal?.title || 'Не указана';
    const goalContext = goal?.context || 'Не указан';
    messages.push({
      role: 'system',
      content: `Цель пользователя: ${goalTitle}\nКонтекст и среда пользователя: ${goalContext}`,
    });

    // Add completed tasks context
    if (completedTasks.length > 0) {
      const completedTasksText = completedTasks
        .map((t) => `- ${t.title}${t.description ? `: ${t.description}` : ''}`)
        .join('\n');
      messages.push({
        role: 'system',
        content: `Выполненные задачи пользователя (${completedTasks.length}):\n${completedTasksText}`,
      });
    }

    // Add task context if provided (безопасно обрабатываем undefined)
    if (taskContext) {
      const taskTitle = taskContext?.title || 'Не указана';
      const taskDescription = taskContext?.description || 'N/A';
      const taskDate = taskContext?.date || 'N/A';
      const taskPriority = taskContext?.priority || 'N/A';
      messages.push({
        role: 'system',
        content: `Текущая задача, о которой спрашивает пользователь:\nНазвание: ${taskTitle}\nОписание: ${taskDescription}\nДата: ${taskDate}\nПриоритет: ${taskPriority}`,
      });
    }

    // Add history
    history.forEach((msg) => {
      messages.push({
        role: msg.role === 'user' ? 'user' : 'assistant',
        content: msg.content,
      });
    });

    // Add current user message
    messages.push({ role: 'user', content: userMessage });

    try {
      this.logger.log('Calling OpenAI API for chat response');
      const startTime = Date.now();
      
      const completion = await Promise.race([
        this.openai.chat.completions.create({
          model: 'gpt-4o-mini', // Используем gpt-4o-mini
          messages,
          temperature: 0.7,
        }),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('OpenAI API timeout after 30s')), 30000)
        ) as Promise<any>
      ]);

      const duration = Date.now() - startTime;
      this.logger.log(`OpenAI API response received in ${duration}ms`);

      return completion.choices[0]?.message?.content || 'Sorry, I could not generate a response.';
    } catch (error: any) {
      this.logger.error('OpenAI chat error:', error);
      
      // Обработка ошибки региона
      if (error?.status === 403 || error?.message?.includes('Country, region, or territory not supported')) {
        return 'Извините, OpenAI API недоступен в вашем регионе. Пожалуйста, используйте VPN или обратитесь к администратору.';
      }
      
      // Обработка других ошибок
      if (error?.status === 401 || error?.message?.includes('Invalid API key')) {
        return 'Ошибка аутентификации OpenAI. Пожалуйста, проверьте настройки API ключа.';
      }
      
      if (error?.status === 429 || error?.message?.includes('rate limit')) {
        return 'Превышен лимит запросов к OpenAI. Пожалуйста, попробуйте позже.';
      }
      
      throw new Error(`Failed to generate chat response: ${error?.message || 'Unknown error'}`);
    }
  }

  /**
   * Генерация ответа для чата с streaming
   */
  async *generateChatResponseStream(params: {
    goal: any;
    history: any[];
    userMessage: string;
    taskContext?: any;
    completedTasks?: any[];
  }): AsyncGenerator<string, void, unknown> {
    const { goal, history, userMessage, taskContext, completedTasks = [] } = params;

    const systemPrompt = taskContext
      ? this.getTaskDiscussionSystemPrompt()
      : this.getChatSystemPrompt();

    const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
      { role: 'system', content: systemPrompt },
    ];

    // Add goal context (безопасно обрабатываем undefined)
    const goalTitle = goal?.title || 'Не указана';
    const goalContext = goal?.context || 'Не указан';
    messages.push({
      role: 'system',
      content: `Цель пользователя: ${goalTitle}\nКонтекст и среда пользователя: ${goalContext}`,
    });

    // Add completed tasks context
    if (completedTasks.length > 0) {
      const completedTasksText = completedTasks
        .map((t) => `- ${t.title}${t.description ? `: ${t.description}` : ''}`)
        .join('\n');
      messages.push({
        role: 'system',
        content: `Выполненные задачи пользователя (${completedTasks.length}):\n${completedTasksText}`,
      });
    }

    // Add task context if provided (безопасно обрабатываем undefined)
    if (taskContext) {
      const taskTitle = taskContext?.title || 'Не указана';
      const taskDescription = taskContext?.description || 'N/A';
      const taskDate = taskContext?.date || 'N/A';
      const taskPriority = taskContext?.priority || 'N/A';
      messages.push({
        role: 'system',
        content: `Текущая задача, о которой спрашивает пользователь:\nНазвание: ${taskTitle}\nОписание: ${taskDescription}\nДата: ${taskDate}\nПриоритет: ${taskPriority}`,
      });
    }

    // Add history
    history.forEach((msg) => {
      messages.push({
        role: msg.role === 'user' ? 'user' : 'assistant',
        content: msg.content,
      });
    });

    // Add current user message
    messages.push({ role: 'user', content: userMessage });

    try {
      const stream = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini', // Используем gpt-4o-mini
        messages,
        temperature: 0.7,
        stream: true,
      });

      for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content || '';
        if (content) {
          yield content;
        }
      }
    } catch (error: any) {
      this.logger.error('OpenAI chat streaming error:', error);
      
      // Обработка ошибки региона
      if (error?.status === 403 || error?.message?.includes('Country, region, or territory not supported')) {
        yield 'Извините, OpenAI API недоступен в вашем регионе. Пожалуйста, используйте VPN или обратитесь к администратору.';
        return;
      }
      
      // Обработка других ошибок
      if (error?.status === 401 || error?.message?.includes('Invalid API key')) {
        yield 'Ошибка аутентификации OpenAI. Пожалуйста, проверьте настройки API ключа.';
        return;
      }
      
      if (error?.status === 429 || error?.message?.includes('rate limit')) {
        yield 'Превышен лимит запросов к OpenAI. Пожалуйста, попробуйте позже.';
        return;
      }
      
      yield 'Извините, произошла ошибка при генерации ответа. Попробуйте позже.';
    }
  }

  private getSystemPrompt(): string {
    return `Ты — профессиональный ИИ-планировщик, создающий реалистичные и структурированные планы достижения целей.

ТВОЯ ЗАДАЧА:
На основе описания цели, контекста пользователя и целевой даты создай детальную стратегию и разбей её на конкретные задачи, распределенные по дням.

КРИТИЧЕСКИ ВАЖНО — РАСПРЕДЕЛЕНИЕ ЗАДАЧ:
• Задачи должны быть ЕЖЕДНЕВНЫМИ по умолчанию — каждый день должен содержать хотя бы 1-2 задачи
• Распределяй задачи РАВНОМЕРНО на весь период от сегодня до целевой даты
• НЕ концентрируй все задачи в начале или конце периода
• Если указано, что не ставить задачи на выходные — пропускай субботу и воскресенье
• Количество дней = количество дней от сегодня до целевой даты (включительно)

ФОРМАТ ОТВЕТА:
Отвечай ТОЛЬКО валидным JSON без дополнительного текста:

{
  "strategy": [
    { "title": "название стратегии", "description": "описание" }
  ],
  "tasks": [
    { "id": "уникальный_id", "title": "название задачи", "description": "описание", "priority": "low|medium|high", "day_index": число }
  ],
  "days_count": общее_количество_дней
}

ПРАВИЛА СОЗДАНИЯ ПЛАНА:

1. Распределение задач (КРИТИЧЕСКИ ВАЖНО):
   - ЕЖЕДНЕВНЫЕ задачи по умолчанию — каждый день должен иметь задачи
   - 1-3 задачи в день (реалистичная нагрузка)
   - Равномерное распределение на весь период
   - Если период 30 дней → создавай 30-90 задач (1-3 задачи в день)
   - Если период 90 дней → создавай 90-270 задач (1-3 задачи в день)
   - Если период 180 дней → создавай 180-540 задач (1-3 задачи в день)

2. Приоритеты:
   - high: критически важные, блокирующие задачи
   - medium: важные, но не блокирующие
   - low: желательные, но не обязательные

3. Качество плана:
   - Учитывай жизненный контекст пользователя
   - План должен быть логичным, последовательным и достижимым
   - Если цель абстрактна — конкретизируй её в стратегии

4. Технические требования:
   - Дни нумеруются с 1 (день 1 = сегодня)
   - day_index должен соответствовать дню от начала плана
   - ID задач должны быть уникальными строками
   - days_count = количество дней от сегодня до целевой даты
   - Не добавляй пояснения вне JSON

Если цель слишком абстрактна — интерпретируй разумно и конкретизируй в плане.`;
  }

  private getUserPrompt(params: {
    goalDescription: string;
    contextDescription: string;
    targetDate?: string;
  }): string {
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    
    let dateInfo = '';
    if (params.targetDate) {
      const targetDate = new Date(params.targetDate);
      const daysDiff = Math.ceil((targetDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      dateInfo = `\n\nЦЕЛЕВАЯ ДАТА: ${params.targetDate}
Количество дней до цели: ${daysDiff} дней
Сегодня: ${todayStr}

ВАЖНО: Создай план на ВСЕ ${daysDiff} дней. Каждый день должен содержать 1-3 задачи. Распределяй задачи РАВНОМЕРНО на весь период.`;
    } else {
      dateInfo = `\n\nВАЖНО: Создай реалистичный план на необходимое количество дней (недели, месяцы или год). 
Не создавай короткие планы на 5-7 дней для серьезных целей — оцени реальное время для достижения результата.
Распредели задачи равномерно на весь период. Каждый день должен содержать 1-3 задачи.`;
    }
    
    return `ОПИСАНИЕ ЦЕЛИ:
${params.goalDescription}

КОНТЕКСТ ПОЛЬЗОВАТЕЛЯ:
${params.contextDescription}${dateInfo}

ЗАДАНИЕ:
Создай детальный план с ежедневными задачами. Распредели задачи равномерно на весь период. Каждый день должен иметь задачи.

Верни только валидный JSON без дополнительного текста.`;
  }

  private getRetryPrompt(): string {
    return `Твой предыдущий ответ был невалидным.

Ты должен вернуть СТРОГО ВАЛИДНЫЙ JSON следующей схемы:

{
  "strategy": [
    { "title": "string", "description": "string" }
  ],
  "tasks": [
    { "id": "string", "title": "string", "description": "string", "priority": "low|medium|high", "day_index": number }
  ],
  "days_count": number
}

Сформируй ответ заново без лишнего текста, только валидный JSON.`;
  }

  private getChatSystemPrompt(): string {
    return `Ты полезный ассистент, помогающий пользователю достичь его цели. 

ВАЖНО: Ты всегда знаешь:
- Какая у пользователя цель (название и контекст)
- Какая у пользователя среда и контекст (его жизненная ситуация)
- Какие задачи уже выполнены пользователем

Используй эту информацию для предоставления практических, действенных советов, учитывая прогресс пользователя и его контекст.`;
  }

  private getTaskDiscussionSystemPrompt(): string {
    return `Ты TaskAssistant - ассистент, помогающий пользователю с конкретной задачей из его плана.

ВАЖНО: Ты всегда знаешь:
- Какая у пользователя цель (название и контекст)
- Какая у пользователя среда и контекст (его жизненная ситуация)
- Какие задачи уже выполнены пользователем
- Информацию о текущей задаче, о которой спрашивает пользователь (название, описание, дата, приоритет)

Используй всю эту информацию для предоставления:
1. Краткий диагноз: почему задача может быть сложной
2. 2-4 тактических способа упростить/выполнить задачу
3. Микро-план с шагами и примерным временем
4. Предложение по переприоритизации, если нужно

Будь практичным и действенным. Учитывай выполненные задачи и контекст пользователя.`;
  }

  /**
   * Извлекает JSON из текста (может быть обернут в markdown или содержать лишний текст)
   */
  private extractJson(text: string): string {
    // Убираем markdown code blocks
    let cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

    // Ищем первый { и последний }
    const firstBrace = cleaned.indexOf('{');
    const lastBrace = cleaned.lastIndexOf('}');

    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
      cleaned = cleaned.substring(firstBrace, lastBrace + 1);
    }

    return cleaned;
  }

  /**
   * Валидирует структуру ответа от ИИ
   */
  private validatePlanResponse(parsed: any): PlanResponse {
    if (!parsed.strategy || !Array.isArray(parsed.strategy)) {
      throw new Error('Invalid plan structure: missing strategy array');
    }

    if (!parsed.tasks || !Array.isArray(parsed.tasks)) {
      throw new Error('Invalid plan structure: missing tasks array');
    }

    if (typeof parsed.days_count !== 'number') {
      throw new Error('Invalid plan structure: missing or invalid days_count');
    }

    // Валидируем стратегию
    const strategy: StrategyItem[] = parsed.strategy.map((item: any, index: number) => {
      if (!item.title || !item.description) {
        throw new Error(`Invalid strategy item at index ${index}: missing title or description`);
      }
      return {
        title: String(item.title).trim(),
        description: String(item.description).trim(),
      };
    });

    // Валидируем задачи
    const tasks: PlanTask[] = parsed.tasks.map((task: any, index: number) => {
      if (!task.title || !task.description) {
        throw new Error(`Invalid task at index ${index}: missing title or description`);
      }

      if (!task.priority || !['low', 'medium', 'high'].includes(task.priority)) {
        throw new Error(`Invalid task at index ${index}: invalid priority`);
      }

      if (typeof task.day_index !== 'number' || task.day_index < 1) {
        throw new Error(`Invalid task at index ${index}: invalid day_index`);
      }

      return {
        id: task.id || `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        title: String(task.title).trim(),
        description: String(task.description).trim(),
        priority: task.priority,
        day_index: task.day_index,
      };
    });

    return {
      strategy,
      tasks,
      days_count: parsed.days_count,
    };
  }

  /**
   * Группирует задачи по дням
   */
  private groupTasksByDay(tasks: PlanTask[]): Record<number, PlanTask[]> {
    const grouped: Record<number, PlanTask[]> = {};

    tasks.forEach((task) => {
      if (!grouped[task.day_index]) {
        grouped[task.day_index] = [];
      }
      grouped[task.day_index].push(task);
    });

    // Сортируем задачи внутри каждого дня по приоритету
    Object.keys(grouped).forEach((day) => {
      const dayNum = parseInt(day);
      grouped[dayNum].sort((a, b) => {
        const priorityOrder = { high: 3, medium: 2, low: 1 };
        return priorityOrder[b.priority] - priorityOrder[a.priority];
      });
    });

    return grouped;
  }
}
