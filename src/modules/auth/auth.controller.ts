import type { CookieOptions, Request, Response } from "express";

import { appConfig } from "@/config/app.config";
import { env } from "@/config/env";
import { AppError } from "@/shared/errors/app-error";
import { ERROR_CODES } from "@/shared/errors/error-codes";
import { HTTP_STATUS } from "@/shared/errors/http-status";
import { sendSuccess } from "@/shared/helpers/api-response";
import { asyncHandler } from "@/shared/helpers/async-handler";
import { isMobileClient } from "@/shared/helpers/client-platform";

import {
  changePassword,
  getCurrentUser,
  login,
  logout,
  refreshSession,
  requestPasswordReset,
  resetPasswordWithOtp,
  verifyPasswordResetOtp,
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

function sessionResponseData(request: Request, input: { user: unknown; accessToken: string; refreshToken: string }) {
  return isMobileClient(request) ? input : input.user;
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
  const { accessToken, refreshToken, user } = await login(request.body, { userAgent: userAgentOf(request) });

  // Mobile authenticates via Bearer token in the response body and never
  // reads cookies — setting them anyway was harmless in isolation, but on
  // Android, native networking (OkHttp) can silently persist and resend a
  // Set-Cookie value on later requests. That stale cookie, combined with
  // mobile never sending a browser Origin header, was tripping the CSRF
  // origin check on subsequent logins and blocking them with a 403 before
  // the real credential check ever ran. See auth debug report.
  if (!isMobileClient(request)) {
    setSessionCookies(response, accessToken, refreshToken);
  }

  return sendSuccess(response, {
    message: "Logged in successfully",
    data: sessionResponseData(request, { user, accessToken, refreshToken }),
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
    const { accessToken, refreshToken, user } = await refreshSession(currentRefreshToken, { userAgent: userAgentOf(request) });

    if (!isMobileClient(request)) {
      setSessionCookies(response, accessToken, refreshToken);
    }

    return sendSuccess(response, {
      message: "Session refreshed successfully",
      data: sessionResponseData(request, { user, accessToken, refreshToken }),
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

  await changePassword({ userId, ...request.body });

  return sendSuccess(response, { message: "Password updated successfully" });
});

export const postForgotPassword = asyncHandler(async (request: Request, response: Response) => {
  const result = await requestPasswordReset(request.body);

  return sendSuccess(response, { message: result.message });
});

export const postVerifyResetOtp = asyncHandler(async (request: Request, response: Response) => {
  const result = await verifyPasswordResetOtp(request.body);

  return sendSuccess(response, { message: "Verification code accepted", data: result });
});

export const postResetPassword = asyncHandler(async (request: Request, response: Response) => {
  const result = await resetPasswordWithOtp(request.body);

  return sendSuccess(response, { message: "Password reset successfully", data: result });
});
