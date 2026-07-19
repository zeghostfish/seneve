import { apiClient } from './client';
import type { SessionSummary } from './types';

export const sessionApi = {
  list(accessToken: string) {
    return apiClient.request<{ sessions: readonly SessionSummary[] }>('/auth/sessions', {
      accessToken,
    });
  },

  revoke(accessToken: string, sessionId: string) {
    return apiClient.request<void>(`/auth/sessions/${sessionId}`, {
      method: 'DELETE',
      accessToken,
    });
  },

  revokeAllExceptCurrent(accessToken: string) {
    return apiClient.request<void>('/auth/sessions', {
      method: 'DELETE',
      accessToken,
    });
  },
};
