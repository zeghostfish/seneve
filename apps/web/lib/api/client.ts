import { ApiRequestError, type ApiErrorBody, type RequestOptions } from './types';

const defaultBaseUrl = 'http://localhost:3000/api/v1';

export function resolveApiBaseUrl(): string {
  return process.env.NEXT_PUBLIC_API_BASE_URL ?? defaultBaseUrl;
}

export class ApiClient {
  constructor(private readonly baseUrl = resolveApiBaseUrl()) {}

  async request<TResponse, TBody = unknown>(
    path: string,
    options: RequestOptions<TBody> = {},
  ): Promise<TResponse> {
    const headers = new Headers({
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'X-Correlation-Id': createCorrelationId(),
    });

    if (options.accessToken) {
      headers.set('Authorization', `Bearer ${options.accessToken}`);
    }

    const response = await fetch(`${this.baseUrl}${path}`, {
      method: options.method ?? 'GET',
      headers,
      credentials: 'include',
      signal: options.signal,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    });

    if (response.status === 204) {
      return undefined as TResponse;
    }

    const payload = (await readJson(response)) as TResponse | ApiErrorBody;

    if (!response.ok) {
      throw new ApiRequestError(response.status, normalizeApiError(payload, response.status));
    }

    return payload as TResponse;
  }
}

function createCorrelationId(): string {
  if (globalThis.crypto && 'randomUUID' in globalThis.crypto) {
    return globalThis.crypto.randomUUID();
  }

  return `web_${Date.now().toString(36)}`;
}

async function readJson(response: Response): Promise<unknown> {
  const text = await response.text();

  if (!text) {
    return {};
  }

  try {
    return JSON.parse(text);
  } catch {
    return {};
  }
}

function normalizeApiError(payload: unknown, status: number): ApiErrorBody {
  if (payload && typeof payload === 'object' && 'code' in payload && 'message' in payload) {
    return payload as ApiErrorBody;
  }

  return {
    code: status === 429 ? 'REQUEST_THROTTLED' : 'REQUEST_FAILED',
    message: status === 429 ? 'Too many requests. Try again later.' : 'Request failed.',
  };
}

export const apiClient = new ApiClient();
