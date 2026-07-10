import type { NextFunction, Request, Response } from "express";

import { AppError } from "@/shared/errors/app-error";
import { ERROR_CODES } from "@/shared/errors/error-codes";
import { HTTP_STATUS } from "@/shared/errors/http-status";

export function requireRole(...roles: string[]) {
  return (request: Request, _response: Response, next: NextFunction) => {
    const userRole = request.user?.role;

    if (!userRole || !roles.includes(userRole)) {
      next(
        new AppError({
          message: "You do not have permission to access this resource.",
          statusCode: HTTP_STATUS.FORBIDDEN,
          errorCode: ERROR_CODES.FORBIDDEN,
        }),
      );
      return;
    }

    next();
  };
}
