import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  try {
    console.log('🚀 Starting NestJS application...');
    console.log('📊 Environment:', process.env.NODE_ENV);
    console.log('🔌 Port:', process.env.PORT || 3000);

    const app = await NestFactory.create(AppModule);
    console.log('✅ NestJS app created');

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
  } catch (error) {
    console.error('❌ Error starting application:', error);
    process.exit(1);
  }
}

bootstrap();
