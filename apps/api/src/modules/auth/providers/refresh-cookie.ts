import type { Response } from 'express';

import type { AuthHttpConfig, RefreshCookiePayload } from '../auth-http.types.js';

export function encodeRefreshCookie(payload: RefreshCookiePayload): string {
  return Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
}

export function decodeRefreshCookie(value: string | undefined): RefreshCookiePayload | null {
  if (!value) {
    return null;
  }

  try {
    const parsed = JSON.parse(Buffer.from(value, 'base64url').toString('utf8')) as unknown;

    if (
      typeof parsed !== 'object' ||
      parsed === null ||
      Array.isArray(parsed) ||
      typeof (parsed as RefreshCookiePayload).tokenId !== 'string' ||
      typeof (parsed as RefreshCookiePayload).rawToken !== 'string'
    ) {
      return null;
    }

    return parsed as RefreshCookiePayload;
  } catch {
    return null;
  }
}

export function setRefreshCookie(
  response: Response,
  config: AuthHttpConfig,
  payload: RefreshCookiePayload,
): void {
  response.cookie(config.refreshCookieName, encodeRefreshCookie(payload), {
    httpOnly: true,
    secure: config.cookieSecure,
    sameSite: 'lax',
    path: config.refreshCookiePath,
    maxAge: config.refreshCookieMaxAgeSeconds * 1000,
  });
}

export function clearRefreshCookie(response: Response, config: AuthHttpConfig): void {
  response.clearCookie(config.refreshCookieName, {
    httpOnly: true,
    secure: config.cookieSecure,
    sameSite: 'lax',
    path: config.refreshCookiePath,
  });
}
