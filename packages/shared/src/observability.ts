import { randomUUID } from 'node:crypto';

export const CORRELATION_ID_HEADER = 'x-correlation-id';

export function createCorrelationId(): string {
  return randomUUID();
}
