import { describe, expect, it } from 'vitest';

import { ApiRequestError } from './types';

describe('ApiRequestError', () => {
  it('preserves stable public error details for UI mapping', () => {
    const error = new ApiRequestError(401, {
      code: 'INVALID_CREDENTIALS',
      message: 'Invalid credentials.',
      correlationId: 'corr_test',
    });

    expect(error.status).toBe(401);
    expect(error.body.code).toBe('INVALID_CREDENTIALS');
    expect(error.message).toBe('Invalid credentials.');
    expect(error.body.correlationId).toBe('corr_test');
  });
});
