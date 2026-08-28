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

  // Fail closed: a verified-but-incomplete token (missing subject or role)
  // must not authenticate as anyone, and must never default to the
  // highest-privilege role. Every real token minted by signAccessToken
  // always carries both claims (auth.service.ts); this only guards against
  // a malformed/future token shape silently granting access.
  const subject = typeof payload?.sub === "string" ? payload.sub : typeof payload?.userId === "string" ? payload.userId : undefined;
  const role = typeof payload?.role === "string" ? payload.role : undefined;

  if (payload && typeof payload === "object" && subject && role) {
    request.user = {
      id: subject,
      role,
      email: typeof payload.email === "string" ? payload.email : undefined,
      companyId: typeof payload.companyId === "string" ? payload.companyId : undefined,
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
