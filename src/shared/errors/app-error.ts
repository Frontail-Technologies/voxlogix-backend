import type { ErrorCode } from "@/shared/errors/error-codes";
import { HTTP_STATUS } from "@/shared/errors/http-status";
import type { ApiErrorItem } from "@/shared/types/api.types";

type AppErrorInput = {
  message: string;
  statusCode?: number;
  errorCode?: ErrorCode;
  errors?: ApiErrorItem[];
  isOperational?: boolean;
};

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly errorCode?: ErrorCode;
  public readonly errors: ApiErrorItem[];
  public readonly isOperational: boolean;

  constructor({
    message,
    statusCode = HTTP_STATUS.INTERNAL_SERVER_ERROR,
    errorCode,
    errors = [],
    isOperational = true,
  }: AppErrorInput) {
    super(message);
    this.name = "AppError";
    this.statusCode = statusCode;
    this.errorCode = errorCode;
    this.errors = errors;
    this.isOperational = isOperational;
  }
}
