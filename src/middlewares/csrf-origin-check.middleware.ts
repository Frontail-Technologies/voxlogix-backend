import type { NextFunction, Request, Response } from "express";

import { appConfig } from "@/config/app.config";
import { allowedOrigins } from "@/config/cors";
import { AppError } from "@/shared/errors/app-error";
import { ERROR_CODES } from "@/shared/errors/error-codes";
import { HTTP_STATUS } from "@/shared/errors/http-status";
import { isMobileClient } from "@/shared/helpers/client-platform";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

function originFromReferer(referer: string | undefined): string | undefined {
  if (!referer) return undefined;
  try {
    return new URL(referer).origin;
  } catch {
    return undefined;
  }
}

/**
 * CORS decides who can read the API's *response* cross-origin; it does not
 * stop a browser from *sending* a state-changing request in the first place
 * (a "simple" request — e.g. a plain HTML form POST with
 * application/x-www-form-urlencoded, which express.urlencoded() parses just
 * like JSON — never triggers a CORS preflight, so it reaches route handlers
 * regardless of the CORS allowlist). httpOnly + sameSite=lax cookies already
 * block most of that, but as defense-in-depth: for any state-changing
 * request that's actually relying on the session *cookie* (not a mobile
 * Bearer token, which no cross-site page can silently attach), require the
 * request's Origin (falling back to Referer's origin) to be one of this
 * deployment's own trusted frontend origins.
 *
 * Mobile requests are exempt entirely — CSRF is a browser-cookie-specific
 * attack; a mobile app's own stored Bearer token was never automatically
 * attachable by a third-party page. This also has to explicitly exempt
 * `?client=mobile` (not just "has a Bearer header"): a mobile *login*
 * request has no Bearer token yet, but Android's native networking can
 * silently persist and resend a cookie from an earlier response — without
 * this exemption, that stale cookie plus mobile's total absence of a
 * browser Origin header would incorrectly look exactly like a cross-site
 * cookie-riding request and get blocked. See auth debug report — this
 * exact scenario broke mobile login in production before this fix.
 */
export function csrfOriginCheckMiddleware(request: Request, _response: Response, next: NextFunction) {
  if (SAFE_METHODS.has(request.method)) {
    next();
    return;
  }

  const hasBearerAuth = request.headers.authorization?.startsWith("Bearer ");
  if (hasBearerAuth || isMobileClient(request)) {
    next();
    return;
  }

  const hasSessionCookie = Boolean(
    request.cookies?.[appConfig.cookieNames.accessToken] || request.cookies?.[appConfig.cookieNames.refreshToken],
  );
  if (!hasSessionCookie) {
    // No cookie session to forge a request against — nothing for CSRF to exploit here.
    next();
    return;
  }

  const origin = request.headers.origin || originFromReferer(request.headers.referer);

  if (!origin || !allowedOrigins.includes(origin)) {
    next(
      new AppError({
        message: "Request origin not allowed.",
        statusCode: HTTP_STATUS.FORBIDDEN,
        errorCode: ERROR_CODES.FORBIDDEN,
      }),
    );
    return;
  }

  next();
}
