import { describe, expect, it } from 'vitest';

import { createHealthServer } from './health-server.js';

describe('createHealthServer', () => {
  it('creates an HTTP server', () => {
    const server = createHealthServer('test-worker');

    expect(server.listening).toBe(false);
    server.close();
  });
});
