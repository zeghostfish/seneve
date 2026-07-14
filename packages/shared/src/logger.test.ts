import { describe, expect, it } from 'vitest';

import { createStructuredLogEntry } from './logger.js';

describe('createStructuredLogEntry', () => {
  it('adds an ISO timestamp to structured log entries', () => {
    const entry = createStructuredLogEntry({
      level: 'info',
      message: 'started',
      service: 'test-service',
    });

    expect(entry.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(entry.service).toBe('test-service');
  });
});
