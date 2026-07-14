const requiredKeys = ['DATABASE_URL', 'REDIS_URL'] as const;

export interface FoundationConfig {
  nodeEnv: string;
  logLevel: string;
  apiPort: number;
  webPort: number;
  workerHealthPort: number;
  databaseUrl: string;
  redisUrl: string;
}

export function loadFoundationConfig(env: NodeJS.ProcessEnv = process.env): FoundationConfig {
  const missing = requiredKeys.filter((key) => !env[key]);

  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }

  return {
    nodeEnv: env.NODE_ENV ?? 'development',
    logLevel: env.LOG_LEVEL ?? 'info',
    apiPort: parsePort(env.API_PORT, 3000),
    webPort: parsePort(env.WEB_PORT, 3001),
    workerHealthPort: parsePort(env.WORKER_HEALTH_PORT, 3002),
    databaseUrl: env.DATABASE_URL!,
    redisUrl: env.REDIS_URL!
  };
}

function parsePort(value: string | undefined, fallback: number): number {
  if (!value) {
    return fallback;
  }

  const parsed = Number.parseInt(value, 10);

  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 65535) {
    throw new Error(`Invalid port value: ${value}`);
  }

  return parsed;
}

