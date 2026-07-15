import 'reflect-metadata';

import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { loadFoundationConfig } from '@seneve/config';
import { createStructuredLogEntry } from '@seneve/shared';
import cookieParser from 'cookie-parser';
import type { NextFunction, Request, Response } from 'express';
import helmet from 'helmet';

import { AppModule } from './app.module.js';
import { correlationMiddleware } from './correlation.middleware.js';

async function bootstrap(): Promise<void> {
  const config = loadFoundationConfig();
  const app = await NestFactory.create(AppModule, {
    bufferLogs: true,
  });

  app.use(helmet());
  app.use(cookieParser());
  app.use(correlationMiddleware);
  app.use((request: Request, response: Response, next: NextFunction) => {
    if (request.path.includes('/auth')) {
      response.setHeader('Cache-Control', 'no-store');
    }

    next();
  });
  app.enableCors({
    origin: config.corsOrigins.length > 0 ? config.corsOrigins : false,
    credentials: config.corsOrigins.length > 0,
  });
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
