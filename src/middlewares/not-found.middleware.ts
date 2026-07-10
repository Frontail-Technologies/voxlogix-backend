import type { NextFunction, Request, Response } from "express";

import { AppError } from "@/shared/errors/app-error";
import { ERROR_CODES } from "@/shared/errors/error-codes";
import { HTTP_STATUS } from "@/shared/errors/http-status";

export function notFoundMiddleware(
  request: Request,
  _response: Response,
  next: NextFunction,
) {
  next(
    new AppError({
      message: `Route not found: ${request.method} ${request.originalUrl}`,
      statusCode: HTTP_STATUS.NOT_FOUND,
      errorCode: ERROR_CODES.NOT_FOUND,
    }),
  );
}
