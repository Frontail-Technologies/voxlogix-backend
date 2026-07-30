import type { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";

import { env } from "@/config/env";
import { AppError } from "@/shared/errors/app-error";
import { ERROR_CODES } from "@/shared/errors/error-codes";
import { HTTP_STATUS } from "@/shared/errors/http-status";
import { sendError } from "@/shared/helpers/api-response";

export function errorMiddleware(
  error: unknown,
  _request: Request,
  response: Response,
  _next: NextFunction,
) {
  void _next;

  if (error instanceof ZodError) {
    return sendError(response, {
      statusCode: HTTP_STATUS.UNPROCESSABLE_ENTITY,
      message: "Validation failed",
      errorCode: ERROR_CODES.VALIDATION_ERROR,
      errors: error.issues.map((issue) => ({
        field: issue.path.join("."),
        message: issue.message,
      })),
    });
  }

  if (error instanceof AppError) {
    return sendError(response, {
      statusCode: error.statusCode,
      message: error.message,
      errorCode: error.errorCode,
      errors: error.errors,
    });
  }

  if (error instanceof Error) {
    return sendError(response, {
      statusCode: HTTP_STATUS.INTERNAL_SERVER_ERROR,
      message: error.message || "Internal server error",
      errorCode: ERROR_CODES.INTERNAL_SERVER_ERROR,
      errors:
        env.NODE_ENV === "development"
          ? [{ message: error.stack || error.message }]
          : [],
    });
  }

  return sendError(response, {
    statusCode: HTTP_STATUS.INTERNAL_SERVER_ERROR,
    message: "Unexpected server error",
    errorCode: ERROR_CODES.INTERNAL_SERVER_ERROR,
    errors: [],
  });
}
