export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface StructuredLogEntry {
  level: LogLevel;
  message: string;
  service: string;
  timestamp: string;
  correlationId?: string;
  context?: Record<string, unknown>;
}

export function createStructuredLogEntry(
  entry: Omit<StructuredLogEntry, 'timestamp'>,
): StructuredLogEntry {
  return {
    ...entry,
    timestamp: new Date().toISOString(),
  };
}
