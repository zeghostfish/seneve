export type HealthStatus = 'ok' | 'degraded' | 'error';

export interface HealthResponse {
  status: HealthStatus;
  service: string;
  timestamp: string;
}
