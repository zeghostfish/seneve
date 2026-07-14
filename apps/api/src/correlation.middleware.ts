import type { NextFunction, Request, Response } from 'express';
import { CORRELATION_ID_HEADER, createCorrelationId } from '@seneve/shared';

export function correlationMiddleware(
  request: Request,
  response: Response,
  next: NextFunction,
): void {
  const incoming = request.header(CORRELATION_ID_HEADER);
  const correlationId = incoming && incoming.length > 0 ? incoming : createCorrelationId();

  response.setHeader(CORRELATION_ID_HEADER, correlationId);
  next();
}
