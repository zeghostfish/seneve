import { Injectable } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { loadFoundationConfig } from '@seneve/config';
import { Redis } from 'ioredis';

@Injectable()
export class ReadinessService {
  async check(): Promise<boolean> {
    const config = loadFoundationConfig();
    const prisma = new PrismaClient({
      datasources: {
        db: {
          url: config.databaseUrl,
        },
      },
    });
    const redis = new Redis(config.redisUrl, {
      lazyConnect: true,
      maxRetriesPerRequest: 1,
    });

    try {
      await prisma.$queryRaw`SELECT 1`;
      await redis.connect();
      await redis.ping();
      return true;
    } catch {
      return false;
    } finally {
      await prisma.$disconnect();
      redis.disconnect();
    }
  }
}
