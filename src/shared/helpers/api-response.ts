import type { Response } from "express";

import { HTTP_STATUS } from "@/shared/errors/http-status";
import type {
  ApiErrorItem,
  ApiErrorResponse,
  ApiSuccessResponse,
} from "@/shared/types/api.types";

type SuccessInput<TData> = {
  statusCode?: number;
  message?: string;
  data?: TData;
  meta?: Record<string, unknown>;
};

type ErrorInput = {
  statusCode?: number;
  message: string;
  errorCode?: string;
  errors?: ApiErrorItem[];
};

export function sendSuccess<TData>(
  response: Response,
  {
    statusCode = HTTP_STATUS.OK,
    message = "Request successful",
    data,
    meta,
  }: SuccessInput<TData>,
) {
  const payload: ApiSuccessResponse<TData> = {
    success: true,
    message,
    data,
    meta,
  };

  return response.status(statusCode).json(payload);
}

export function sendError(
  response: Response,
  {
    statusCode = HTTP_STATUS.BAD_REQUEST,
    message,
    errorCode,
    errors = [],
  }: ErrorInput,
) {
  const payload: ApiErrorResponse = {
    success: false,
    message,
    errorCode,
    errors,
  };

  return response.status(statusCode).json(payload);
}
