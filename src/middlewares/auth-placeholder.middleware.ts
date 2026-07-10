import type { NextFunction, Request, Response } from "express";

import { appConfig } from "@/config/app.config";
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

  if (payload && typeof payload === "object") {
    request.user = {
      id: String(payload.sub ?? payload.userId ?? "placeholder-user"),
      role: String(payload.role ?? "MASTER"),
      email:
        typeof payload.email === "string" ? payload.email : undefined,
    };
  }

  // TODO: Replace token-only parsing with real auth module and user lookup.
  next();
}
