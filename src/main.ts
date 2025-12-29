import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  try {
    console.log('🚀 Starting NestJS application...');
    console.log('📊 Environment:', process.env.NODE_ENV);
    console.log('🔌 Port:', process.env.PORT || 3000);
    console.log('🏠 Working directory:', process.cwd());
    console.log('📁 __dirname:', __dirname);

    // Helper function to strip quotes from environment variables
    const stripQuotes = (value: string | undefined): string | undefined => {
      if (!value) return value;
      // Remove surrounding quotes (single or double)
      return value.replace(/^["']|["']$/g, '');
    };

    // Clean environment variables from quotes
    if (process.env.DATABASE_HOST) {
      process.env.DATABASE_HOST = stripQuotes(process.env.DATABASE_HOST);
    }
    if (process.env.DATABASE_PORT) {
      process.env.DATABASE_PORT = stripQuotes(process.env.DATABASE_PORT);
    }
    if (process.env.DATABASE_USER) {
      process.env.DATABASE_USER = stripQuotes(process.env.DATABASE_USER);
    }
    if (process.env.DATABASE_PASSWORD) {
      process.env.DATABASE_PASSWORD = stripQuotes(process.env.DATABASE_PASSWORD);
    }
    if (process.env.DATABASE_NAME) {
      process.env.DATABASE_NAME = stripQuotes(process.env.DATABASE_NAME);
    }
    if (process.env.DATABASE_SSL) {
      process.env.DATABASE_SSL = stripQuotes(process.env.DATABASE_SSL);
    }
    if (process.env.JWT_SECRET) {
      process.env.JWT_SECRET = stripQuotes(process.env.JWT_SECRET);
    }
    if (process.env.JWT_REFRESH_SECRET) {
      process.env.JWT_REFRESH_SECRET = stripQuotes(process.env.JWT_REFRESH_SECRET);
    }
    if (process.env.OPENAI_API_KEY) {
      process.env.OPENAI_API_KEY = stripQuotes(process.env.OPENAI_API_KEY);
    }
    if (process.env.REDIS_HOST) {
      process.env.REDIS_HOST = stripQuotes(process.env.REDIS_HOST);
    }
    if (process.env.REDIS_PORT) {
      process.env.REDIS_PORT = stripQuotes(process.env.REDIS_PORT);
    }
    if (process.env.REDIS_PASSWORD) {
      process.env.REDIS_PASSWORD = stripQuotes(process.env.REDIS_PASSWORD);
    }
    if (process.env.REDIS_TLS) {
      process.env.REDIS_TLS = stripQuotes(process.env.REDIS_TLS);
    }
    if (process.env.PORT) {
      process.env.PORT = stripQuotes(process.env.PORT);
    }
    if (process.env.NODE_ENV) {
      process.env.NODE_ENV = stripQuotes(process.env.NODE_ENV);
    }

    // Log environment variables (without secrets)
    console.log('🔧 Environment check:');
    console.log('   - DATABASE_HOST:', process.env.DATABASE_HOST ? `✅ Set (${process.env.DATABASE_HOST})` : '❌ Missing');
    console.log('   - DATABASE_PORT:', process.env.DATABASE_PORT ? `✅ Set (${process.env.DATABASE_PORT})` : '❌ Missing');
    console.log('   - DATABASE_USER:', process.env.DATABASE_USER ? '✅ Set' : '❌ Missing');
    console.log('   - DATABASE_PASSWORD:', process.env.DATABASE_PASSWORD ? '✅ Set' : '❌ Missing');
    console.log('   - DATABASE_NAME:', process.env.DATABASE_NAME ? `✅ Set (${process.env.DATABASE_NAME})` : '❌ Missing');
    console.log('   - DATABASE_SSL:', process.env.DATABASE_SSL ? `✅ Set (${process.env.DATABASE_SSL})` : '❌ Missing');
    console.log('   - JWT_SECRET:', process.env.JWT_SECRET ? '✅ Set' : '❌ Missing');
    console.log('   - JWT_REFRESH_SECRET:', process.env.JWT_REFRESH_SECRET ? '✅ Set' : '❌ Missing');
    console.log('   - OPENAI_API_KEY:', process.env.OPENAI_API_KEY ? '✅ Set' : '❌ Missing');
    console.log('   - REDIS_HOST:', process.env.REDIS_HOST ? `✅ Set (${process.env.REDIS_HOST})` : '❌ Missing');
    console.log('   - REDIS_PORT:', process.env.REDIS_PORT ? `✅ Set (${process.env.REDIS_PORT})` : '❌ Missing');
    console.log('   - REDIS_TLS:', process.env.REDIS_TLS ? `✅ Set (${process.env.REDIS_TLS})` : '❌ Missing');
    console.log('   - PORT:', process.env.PORT ? `✅ Set (${process.env.PORT})` : '❌ Missing');
    console.log('   - NODE_ENV:', process.env.NODE_ENV ? `✅ Set (${process.env.NODE_ENV})` : '❌ Missing');

    // Создаем приложение с обработкой ошибок БД
    let app;
    try {
      app = await NestFactory.create(AppModule, {
        // Не логируем ошибки подключения к БД
        logger: ['error', 'warn', 'log'],
      });
      console.log('✅ NestJS app created');
    } catch (error) {
      // Если ошибка связана с БД, все равно запускаем приложение
      if (error.message && error.message.includes('ECONNREFUSED')) {
        console.warn('⚠️ Database connection failed, but continuing startup...');
        app = await NestFactory.create(AppModule, {
          logger: ['error', 'warn', 'log'],
        });
        console.log('✅ NestJS app created (without database)');
      } else {
        throw error;
      }
    }

    // Enable CORS
    app.enableCors({
      origin: process.env.FRONTEND_URL || 'http://localhost:8081',
      credentials: true,
    });
    console.log('✅ CORS enabled');

    // Enable global validation
    app.useGlobalPipes(new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }));
    console.log('✅ Validation pipes enabled');

    // Set global prefix for all routes
    app.setGlobalPrefix('api/v1');
    console.log('✅ Global prefix set to /api/v1');

    const port = process.env.PORT || 3000;
    const host = '0.0.0.0'; // Listen on all interfaces for Railway

    await app.listen(port, host);

    console.log(`🚀 Application is running on: http://${host}:${port}/api/v1`);
    console.log(`📊 Health check: http://localhost:${port}/api/v1/health`);
    console.log(`🌐 External access: http://localhost:${port}/api/v1/health`);
    console.log(`🔍 Available routes:`);
    console.log(`   GET http://localhost:${port}/api/v1/health`);
    console.log(`   GET http://localhost:${port}/`);

    // Keep the process alive
    process.on('SIGTERM', () => {
      console.log('📴 SIGTERM received, shutting down gracefully');
      app.close();
    });

    process.on('SIGINT', () => {
      console.log('📴 SIGINT received, shutting down gracefully');
      app.close();
    });

  } catch (error) {
    console.error('❌ Error starting application:', error);
    console.error('❌ Error details:', error.message);
    console.error('❌ Stack trace:', error.stack);
    process.exit(1);
  }
}

bootstrap();
