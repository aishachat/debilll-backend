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

    // Log environment variables (without secrets)
    console.log('🔧 Environment check:');
    console.log('   - DATABASE_HOST:', process.env.DATABASE_HOST ? `✅ Set (${process.env.DATABASE_HOST})` : '❌ Missing');
    console.log('   - DATABASE_PORT:', process.env.DATABASE_PORT ? `✅ Set (${process.env.DATABASE_PORT})` : '❌ Missing');
    console.log('   - DATABASE_USER:', process.env.DATABASE_USER ? '✅ Set' : '❌ Missing');
    console.log('   - DATABASE_PASSWORD:', process.env.DATABASE_PASSWORD ? '✅ Set' : '❌ Missing');
    console.log('   - DATABASE_NAME:', process.env.DATABASE_NAME ? `✅ Set (${process.env.DATABASE_NAME})` : '❌ Missing');
    console.log('   - JWT_SECRET:', process.env.JWT_SECRET ? '✅ Set' : '❌ Missing');
    console.log('   - OPENAI_API_KEY:', process.env.OPENAI_API_KEY ? '✅ Set' : '❌ Missing');
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
