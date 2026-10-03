import type { CookieOptions, Request, Response } from "express";

import { appConfig } from "@/config/app.config";
import { env } from "@/config/env";
import { AppError } from "@/shared/errors/app-error";
import { ERROR_CODES } from "@/shared/errors/error-codes";
import { HTTP_STATUS } from "@/shared/errors/http-status";
import { sendSuccess } from "@/shared/helpers/api-response";
import { asyncHandler } from "@/shared/helpers/async-handler";
import { isMobileClient } from "@/shared/helpers/client-platform";
import type { SessionResult } from "./auth.service";

import {
  changePassword,
  getCurrentUser,
  login,
  logout,
  refreshSession,
  requestPasswordReset,
  resetPasswordWithToken,
} from "./auth.service";

function userAgentOf(request: Request) {
  const value = request.headers["user-agent"];
  return typeof value === "string" ? value.slice(0, 255) : undefined;
}

function getSessionCookieOptions(): CookieOptions {
  return {
    httpOnly: true,
    secure: env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    ...(appConfig.cookieDomain ? { domain: appConfig.cookieDomain } : {}),
  };
}

function setSessionCookies(response: Response, accessToken: string, refreshToken: string) {
  response.cookie(appConfig.cookieNames.accessToken, accessToken, getSessionCookieOptions());
  response.cookie(appConfig.cookieNames.refreshToken, refreshToken, getSessionCookieOptions());
}

function clearSessionCookies(response: Response) {
  response.clearCookie(appConfig.cookieNames.accessToken, getSessionCookieOptions());
  response.clearCookie(appConfig.cookieNames.refreshToken, getSessionCookieOptions());
}

function sessionResponseData(request: Request, input: SessionResult) {
  return isMobileClient(request) ? input : input.user;
}

function applySessionToResponse(request: Request, response: Response, session: SessionResult) {
  if (!isMobileClient(request)) {
    setSessionCookies(response, session.accessToken, session.refreshToken);
  }
}

function refreshTokenFromRequest(request: Request) {
  const cookieToken = request.cookies?.[appConfig.cookieNames.refreshToken] as string | undefined;
  const bearerToken = request.headers.authorization?.startsWith("Bearer ")
    ? request.headers.authorization.replace("Bearer ", "").trim()
    : undefined;
  const bodyToken = typeof request.body?.refreshToken === "string" ? request.body.refreshToken : undefined;

  return cookieToken ?? bodyToken ?? bearerToken;
}

export const postLogin = asyncHandler(async (request: Request, response: Response) => {
  const session = await login(request.body, { userAgent: userAgentOf(request) });

  if (!isMobileClient(request)) {
    setSessionCookies(response, session.accessToken, session.refreshToken);
  }

  return sendSuccess(response, {
    message: "Logged in successfully",
    data: sessionResponseData(request, session),
  });
});

export const getMe = asyncHandler(async (request: Request, response: Response) => {
  const userContext = request.user;

  if (!userContext) {
    throw new AppError({
      message: "Authentication required.",
      statusCode: HTTP_STATUS.UNAUTHORIZED,
      errorCode: ERROR_CODES.UNAUTHORIZED,
    });
  }

  const user = await getCurrentUser(userContext.id);

  return sendSuccess(response, { data: user });
});

export const postRefresh = asyncHandler(async (request: Request, response: Response) => {
  try {
    const currentRefreshToken = refreshTokenFromRequest(request);
    const session = await refreshSession(currentRefreshToken, { userAgent: userAgentOf(request) });

    if (!isMobileClient(request)) {
      setSessionCookies(response, session.accessToken, session.refreshToken);
    }

    return sendSuccess(response, {
      message: "Session refreshed successfully",
      data: sessionResponseData(request, session),
    });
  } catch (error) {
    clearSessionCookies(response);
    throw error;
  }
});

export const postLogout = asyncHandler(async (request: Request, response: Response) => {
  const currentRefreshToken = refreshTokenFromRequest(request);
  await logout(currentRefreshToken);
  clearSessionCookies(response);

  return sendSuccess(response, { message: "Logged out successfully" });
});

export const postChangePassword = asyncHandler(async (request: Request, response: Response) => {
  const userId = request.user?.id;

  if (!userId) {
    throw new AppError({
      message: "Authentication required.",
      statusCode: HTTP_STATUS.UNAUTHORIZED,
      errorCode: ERROR_CODES.UNAUTHORIZED,
    });
  }

  const session = await changePassword({ userId, ...request.body, userAgent: userAgentOf(request) });

  // Issue fresh cookies / return new tokens so the client is immediately in the
  // authenticated state with requirePasswordReset=false — no extra login step needed.
  applySessionToResponse(request, response, session);

  return sendSuccess(response, {
    message: "Password updated successfully",
    data: sessionResponseData(request, session),
  });
});

export const postForgotPassword = asyncHandler(async (request: Request, response: Response) => {
  const result = await requestPasswordReset(request.body);

  return sendSuccess(response, { message: result.message });
});

export const postResetPasswordWithToken = asyncHandler(async (request: Request, response: Response) => {
  const result = await resetPasswordWithToken(request.body);

  return sendSuccess(response, { message: result.message });
});
