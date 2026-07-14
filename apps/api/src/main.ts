import 'reflect-metadata';

import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { loadFoundationConfig } from '@seneve/config';
import { createStructuredLogEntry } from '@seneve/shared';

import { AppModule } from './app.module.js';
import { correlationMiddleware } from './correlation.middleware.js';

async function bootstrap(): Promise<void> {
  const config = loadFoundationConfig();
  const app = await NestFactory.create(AppModule, {
    bufferLogs: true,
  });

  app.use(correlationMiddleware);
  app.setGlobalPrefix('api/v1');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  const openApiConfig = new DocumentBuilder()
    .setTitle('Seneve API')
    .setDescription('Seneve foundation API contract.')
    .setVersion('0.1.0')
    .build();

  const document = SwaggerModule.createDocument(app, openApiConfig);
  SwaggerModule.setup('api/docs', app, document);

  await app.listen(config.apiPort);

  console.log(
    JSON.stringify(
      createStructuredLogEntry({
        level: 'info',
        message: 'API service started',
        service: 'seneve-api',
        context: { port: config.apiPort },
      }),
    ),
  );
}

void bootstrap();
