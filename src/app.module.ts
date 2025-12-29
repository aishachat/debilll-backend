import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ThrottlerModule } from '@nestjs/throttler';
import { BullModule } from '@nestjs/bull';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { GoalsModule } from './goals/goals.module';
import { PlansModule } from './plans/plans.module';
import { TasksModule } from './tasks/tasks.module';
import { MessagesModule } from './messages/messages.module';
import { IntegrationsModule } from './integrations/integrations.module';
import { OpenAIModule } from './openai/openai.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    TypeOrmModule.forRootAsync({
      useFactory: () => ({
        type: 'postgres',
        // Поддержка connection string или отдельных параметров
        ...(process.env.DATABASE_URL
          ? {
              url: process.env.DATABASE_URL,
              // Явно устанавливаем SSL для connection string с sslmode
              ssl: process.env.DATABASE_URL.includes('sslmode')
                ? { rejectUnauthorized: false }
                : undefined,
            }
          : {
              host: process.env.DATABASE_HOST || 'localhost',
              port: parseInt(process.env.DATABASE_PORT || '5432'),
              username: process.env.DATABASE_USER || 'postgres',
              password: process.env.DATABASE_PASSWORD || 'postgres',
              database: process.env.DATABASE_NAME || 'listai',
              ssl: process.env.DATABASE_SSL === 'true'
                ? { rejectUnauthorized: false }
                : false,
            }),
        entities: [__dirname + '/**/*.entity{.ts,.js}'],
        synchronize: process.env.NODE_ENV !== 'production', // Only in dev - создает таблицы автоматически
        logging: process.env.NODE_ENV === 'development',
        // Позволяем приложению запуститься даже если БД недоступна
        retryAttempts: 0, // Не пытаемся переподключаться
        retryDelay: 0,
        keepConnectionAlive: false, // Не держим соединение
        // Не блокируем запуск приложения при ошибке подключения
        autoLoadEntities: true,
        // В продакшене отключаем synchronize
        dropSchema: false,
        // Добавляем таймауты
        connectTimeoutMS: 5000,
        acquireTimeoutMS: 5000,
        // Graceful handling of connection errors
        extra: {
          // Handle connection errors gracefully
          connectionTimeoutMillis: 5000,
        },
      }),
      // Если БД недоступна, модуль все равно загрузится
    }),
    // Для Vercel используем Redis только если доступен, иначе отключаем очереди
    ...(process.env.REDIS_HOST && process.env.REDIS_HOST !== 'localhost' ? [BullModule.forRoot({
      redis: {
        host: process.env.REDIS_HOST,
        port: parseInt(process.env.REDIS_PORT || '6379'),
        password: process.env.REDIS_PASSWORD,
        tls: process.env.REDIS_TLS === 'true' ? {} : undefined,
      },
    })] : []),
    ThrottlerModule.forRoot([
      {
        ttl: 60000, // 1 minute
        limit: 60, // 60 requests per minute
      },
    ]),
    AuthModule,
    UsersModule,
    GoalsModule,
    PlansModule,
    TasksModule,
    MessagesModule,
    IntegrationsModule,
    OpenAIModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
