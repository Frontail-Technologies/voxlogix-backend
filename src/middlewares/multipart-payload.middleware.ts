import type { NextFunction, Request, Response } from "express";

import { AppError } from "@/shared/errors/app-error";
import { ERROR_CODES } from "@/shared/errors/error-codes";
import { HTTP_STATUS } from "@/shared/errors/http-status";

export function parseMultipartPayload(
  request: Request,
  _response: Response,
  next: NextFunction,
) {
  const payload = request.body?.payload;

  if (typeof payload !== "string") {
    next();
    return;
  }

  try {
    request.body = JSON.parse(payload) as Record<string, unknown>;
    next();
  } catch {
    next(
      new AppError({
        message: "Invalid multipart payload.",
        statusCode: HTTP_STATUS.BAD_REQUEST,
        errorCode: ERROR_CODES.VALIDATION_ERROR,
      }),
    );
  }
}
