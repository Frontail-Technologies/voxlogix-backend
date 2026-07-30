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
