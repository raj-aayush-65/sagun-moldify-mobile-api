import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const logger = new Logger('Bootstrap');

  const app = await NestFactory.create(AppModule, {
    logger: ['log', 'error', 'warn', 'debug', 'verbose'],
  });

  // Enable CORS for mobile app and GitHub Pages
  app.enableCors({
    origin: true, // Allow all origins in production
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    credentials: true,
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-Requested-With',
      'Access-Control-Allow-Origin',
    ],
    exposedHeaders: ['Authorization'],
  });

  // Global prefix for all API routes
  app.setGlobalPrefix('api/v1');

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    })
  );

  // Swagger documentation
  const config = new DocumentBuilder()
    .setTitle('Sagun Moldify API')
    .setDescription('API documentation for Sagun Moldify application')
    .setVersion('1.0')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  const port = process.env.PORT || 3000;
  await app.listen(port);

  const nodeEnv = process.env.NODE_ENV || 'development';

  logger.log('===========================================');
  logger.log('🚀 Sagun Moldify API Starting Up...');
  logger.log('===========================================');
  logger.log(`📊 Environment: ${nodeEnv}`);
  logger.log(`🌐 Server URL: http://localhost:${port}`);
  logger.log(`📖 Swagger Docs: http://localhost:${port}/api/docs`);
  logger.log('📦 Database migrations will run automatically...');
  logger.log('===========================================');
}

bootstrap();
