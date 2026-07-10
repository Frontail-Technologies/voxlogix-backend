export type ApiErrorItem = {
  field?: string;
  message: string;
};

export type ApiSuccessResponse<TData = unknown> = {
  success: true;
  message: string;
  data?: TData;
  meta?: Record<string, unknown>;
};

export type ApiErrorResponse = {
  success: false;
  message: string;
  errorCode?: string;
  errors: ApiErrorItem[];
};
