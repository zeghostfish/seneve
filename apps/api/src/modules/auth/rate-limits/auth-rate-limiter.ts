import { createHash } from 'node:crypto';

import type { Redis } from 'ioredis';

export interface RateLimitInput {
  readonly key: string;
  readonly limit: number;
  readonly windowSeconds: number;
}

export interface AuthRateLimiter {
  consume(input: RateLimitInput): Promise<boolean>;
}

export class RedisAuthRateLimiter implements AuthRateLimiter {
  constructor(
    private readonly redis: Redis,
    private readonly namespace = 'seneve:auth-rate',
  ) {}

  async consume(input: RateLimitInput): Promise<boolean> {
    const key = `${this.namespace}:${hashKey(input.key)}`;
    const count = await this.redis.incr(key);

    if (count === 1) {
      await this.redis.expire(key, input.windowSeconds);
    }

    return count <= input.limit;
  }
}

export class InMemoryAuthRateLimiter implements AuthRateLimiter {
  private readonly buckets = new Map<string, { count: number; expiresAt: number }>();

  async consume(input: RateLimitInput): Promise<boolean> {
    const now = Date.now();
    const key = hashKey(input.key);
    const current = this.buckets.get(key);

    if (!current || current.expiresAt <= now) {
      this.buckets.set(key, {
        count: 1,
        expiresAt: now + input.windowSeconds * 1000,
      });
      return true;
    }

    current.count += 1;
    return current.count <= input.limit;
  }
}

function hashKey(value: string): string {
  return createHash('sha256').update(value).digest('base64url');
}
