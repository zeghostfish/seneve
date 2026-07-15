import type { Request } from 'express';
import { randomUUID } from 'node:crypto';

export function requestIdFrom(request: Request): string | null {
  const value = request.headers['x-request-id'];
  return typeof value === 'string' && value.length <= 128 ? value : null;
}

export function correlationIdFrom(request: Request): string {
  const value = request.headers['x-correlation-id'];

  if (typeof value === 'string' && value.length > 0 && value.length <= 128) {
    return value;
  }

  const existing = request.headers['x-request-id'];

  if (typeof existing === 'string' && existing.length > 0 && existing.length <= 128) {
    return existing;
  }

  return randomUUID();
}

export function bearerTokenFrom(request: Request): string | null {
  const authorization = request.headers.authorization;

  if (!authorization?.startsWith('Bearer ')) {
    return null;
  }

  return authorization.slice('Bearer '.length).trim() || null;
}
