import type { Request } from 'express';

export interface AuthHttpConfig {
  readonly refreshCookieName: string;
  readonly refreshCookiePath: string;
  readonly refreshCookieMaxAgeSeconds: number;
  readonly cookieSecure: boolean;
  readonly allowedOrigins: readonly string[];
}

export interface AuthenticatedHttpRequest extends Request {
  auth?: {
    readonly identityId: string;
    readonly sessionId: string;
    readonly tokenVersion: number;
  };
}

export interface RefreshCookiePayload {
  readonly tokenId: string;
  readonly rawToken: string;
}
