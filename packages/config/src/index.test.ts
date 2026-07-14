import { describe, expect, it } from 'vitest';

import { loadFoundationConfig } from './index.js';

describe('loadFoundationConfig', () => {
  it('loads required foundation configuration with defaults', () => {
    const config = loadFoundationConfig({
      DATABASE_URL: 'postgresql://seneve:seneve@localhost:5432/seneve',
      REDIS_URL: 'redis://localhost:6379',
    });

    expect(config.nodeEnv).toBe('development');
    expect(config.apiPort).toBe(3000);
    expect(config.databaseUrl).toContain('postgresql://');
  });

  it('rejects missing required variables', () => {
    expect(() => loadFoundationConfig({})).toThrow(
      'Missing required environment variables: DATABASE_URL, REDIS_URL',
    );
  });
});
