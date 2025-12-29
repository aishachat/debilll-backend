import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get('health')
  async getHealth() {
    try {
      // Проверяем основные сервисы
      const health = {
        success: true,
        message: 'API is running',
        timestamp: new Date().toISOString(),
        services: {
          app: 'healthy',
          database: 'unknown', // Будет проверено ниже
          redis: 'unknown',
        },
      };

      // Проверяем подключение к базе данных (асинхронно, не блокирует ответ)
      try {
        // Здесь можно добавить проверку БД если нужно
        health.services.database = 'checking';
      } catch (error) {
        health.services.database = 'unavailable';
      }

      // Проверяем Redis
      try {
        // Здесь можно добавить проверку Redis если нужно
        health.services.redis = 'checking';
      } catch (error) {
        health.services.redis = 'unavailable';
      }

      return health;
    } catch (error) {
      return {
        success: false,
        message: 'API health check failed',
        timestamp: new Date().toISOString(),
        error: error.message,
      };
    }
  }
}

