import { Injectable } from '@nestjs/common';
import { loadFoundationConfig } from '@seneve/config';
import { Redis } from 'ioredis';

@Injectable()
export class ReadinessService {
  async check(): Promise<boolean> {
    const config = loadFoundationConfig();
    const redis = new Redis(config.redisUrl, {
      lazyConnect: true,
      maxRetriesPerRequest: 1,
    });

    try {
      await redis.connect();
      await redis.ping();
      return true;
    } catch {
      return false;
    } finally {
      redis.disconnect();
    }
  }
}
