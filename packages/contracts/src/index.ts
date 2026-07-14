export interface ApiResponse<TData> {
  success: boolean;
  data: TData | null;
  meta: Record<string, unknown>;
  errors: ApiError[] | null;
}

export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
  traceId?: string;
}

