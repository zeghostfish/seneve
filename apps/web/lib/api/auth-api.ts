import { apiClient } from './client';
import type { AuthenticatedResponse } from './types';

export interface RegisterRequest {
  readonly email: string;
  readonly password: string;
  readonly displayName?: string;
}

export interface LoginRequest {
  readonly email: string;
  readonly password: string;
}

export interface CompleteEmailVerificationRequest {
  readonly token: string;
}

export interface RequestPasswordResetRequest {
  readonly email: string;
}

export interface CompletePasswordResetRequest {
  readonly token: string;
  readonly password: string;
}

export const authApi = {
  register(input: RegisterRequest) {
    return apiClient.request<AuthenticatedResponse>('/auth/register', {
      method: 'POST',
      body: input,
    });
  },

  login(input: LoginRequest) {
    return apiClient.request<AuthenticatedResponse>('/auth/login', {
      method: 'POST',
      body: input,
    });
  },

  refresh() {
    return apiClient.request<AuthenticatedResponse>('/auth/refresh', {
      method: 'POST',
    });
  },

  logout(accessToken: string | null) {
    return apiClient.request<void>('/auth/logout', {
      method: 'POST',
      accessToken,
    });
  },

  logoutAll(accessToken: string | null) {
    return apiClient.request<void>('/auth/logout-all', {
      method: 'POST',
      accessToken,
    });
  },

  requestEmailVerification(accessToken: string | null) {
    return apiClient.request<{ accepted: boolean }>('/auth/email-verification/request', {
      method: 'POST',
      accessToken,
    });
  },

  resendEmailVerification(accessToken: string | null) {
    return apiClient.request<{ accepted: boolean }>('/auth/email-verification/resend', {
      method: 'POST',
      accessToken,
    });
  },

  completeEmailVerification(input: CompleteEmailVerificationRequest) {
    return apiClient.request<{ verified: boolean }>('/auth/email-verification/complete', {
      method: 'POST',
      body: input,
    });
  },

  requestPasswordReset(input: RequestPasswordResetRequest) {
    return apiClient.request<{ accepted: boolean }>('/auth/password-reset/request', {
      method: 'POST',
      body: input,
    });
  },

  completePasswordReset(input: CompletePasswordResetRequest) {
    return apiClient.request<{ completed: boolean }>('/auth/password-reset/complete', {
      method: 'POST',
      body: input,
    });
  },
};
