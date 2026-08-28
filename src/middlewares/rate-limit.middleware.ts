import rateLimit from "express-rate-limit";
import type { NextFunction, Request, Response } from "express";

import { env } from "@/config/env";

const disabledRateLimitMiddleware = (
  _request: Request,
  _response: Response,
  next: NextFunction,
) => next();

const enabledRateLimitMiddleware = rateLimit({
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  max: env.RATE_LIMIT_MAX_REQUESTS,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many requests, please try again later.",
    errors: [],
  },
});

export const rateLimitMiddleware = env.RATE_LIMIT_ENABLED
  ? enabledRateLimitMiddleware
  : disabledRateLimitMiddleware;

// Credential-guessing endpoints (login, OTP verify, password reset) need a
// much tighter limit than the generic API-wide one, and — unlike the generic
// limiter — this one is always active regardless of RATE_LIMIT_ENABLED:
// brute-forcing a password must never be left fully unthrottled by a missing
// env var. Keyed by IP; intentionally generous enough that a legitimate user
// mistyping their password a few times is never blocked.
export const authRateLimitMiddleware = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many attempts, please try again later.",
    errors: [],
  },
});
