import type { NextFunction, Request, Response } from "express";

import { appConfig } from "@/config/app.config";
import { AppError } from "@/shared/errors/app-error";
import { ERROR_CODES } from "@/shared/errors/error-codes";
import { HTTP_STATUS } from "@/shared/errors/http-status";
import { verifyAccessToken } from "@/shared/security/jwt";

export function authPlaceholderMiddleware(
  request: Request,
  _response: Response,
  next: NextFunction,
) {
  const bearerToken = request.headers.authorization?.startsWith("Bearer ")
    ? request.headers.authorization.replace("Bearer ", "").trim()
    : undefined;

  const cookieToken = request.cookies?.[appConfig.cookieNames.accessToken] as
    | string
    | undefined;

  const token = bearerToken || cookieToken;

  if (!token) {
    next();
    return;
  }

  const payload = verifyAccessToken(token);

  const subject = typeof payload?.sub === "string" ? payload.sub : typeof payload?.userId === "string" ? payload.userId : undefined;
  const role = typeof payload?.role === "string" ? payload.role : undefined;

  if (payload && typeof payload === "object" && subject && role) {
    request.user = {
      id: subject,
      role,
      email: typeof payload.email === "string" ? payload.email : undefined,
      companyId: typeof payload.companyId === "string" ? payload.companyId : undefined,
      requirePasswordReset: payload.requirePasswordReset === true,
    };
  }

  next();
}

export function requireAuth(request: Request, _response: Response, next: NextFunction) {
  if (!request.user) {
    next(
      new AppError({
        message: "Authentication required.",
        statusCode: HTTP_STATUS.UNAUTHORIZED,
        errorCode: ERROR_CODES.UNAUTHORIZED,
      }),
    );
    return;
  }

  next();
}

// Allowlist of path prefixes that are permitted even when requirePasswordReset=true.
// Everything else gets a 403 PASSWORD_CHANGE_REQUIRED so the user is forced through
// the change-password flow before accessing any real application data.
const PASSWORD_RESET_ALLOWED_PREFIXES = [
  "/api/auth/me",
  "/api/auth/change-password",
  "/api/auth/logout",
  "/api/auth/refresh",
  "/api/auth/forgot-password",
  "/api/auth/reset-password",
];

export function requirePasswordNotExpired(
  request: Request,
  _response: Response,
  next: NextFunction,
) {
  if (!request.user?.requirePasswordReset) {
    next();
    return;
  }

  const path = request.path;
  const allowed = PASSWORD_RESET_ALLOWED_PREFIXES.some(
    (prefix) => path === prefix || path.startsWith(`${prefix}/`),
  );

  if (allowed) {
    next();
    return;
  }

  next(
    new AppError({
      message: "You must change your password before continuing.",
      statusCode: HTTP_STATUS.FORBIDDEN,
      errorCode: ERROR_CODES.PASSWORD_CHANGE_REQUIRED,
    }),
  );
}
