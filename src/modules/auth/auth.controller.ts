import type { CookieOptions, Request, Response } from "express";

import { appConfig } from "@/config/app.config";
import { env } from "@/config/env";
import { AppError } from "@/shared/errors/app-error";
import { ERROR_CODES } from "@/shared/errors/error-codes";
import { HTTP_STATUS } from "@/shared/errors/http-status";
import { sendSuccess } from "@/shared/helpers/api-response";
import { asyncHandler } from "@/shared/helpers/async-handler";

import {
  changePassword,
  getCurrentUser,
  login,
  refreshSession,
  requestPasswordReset,
  resetPasswordWithOtp,
  verifyPasswordResetOtp,
} from "./auth.service";

const sessionCookieOptions: CookieOptions = {
  httpOnly: true,
  secure: env.NODE_ENV === "production",
  sameSite: "lax",
  path: "/",
};

function setSessionCookies(response: Response, accessToken: string, refreshToken: string) {
  response.cookie(appConfig.cookieNames.accessToken, accessToken, sessionCookieOptions);
  response.cookie(appConfig.cookieNames.refreshToken, refreshToken, sessionCookieOptions);
}

function clearSessionCookies(response: Response) {
  response.clearCookie(appConfig.cookieNames.accessToken, sessionCookieOptions);
  response.clearCookie(appConfig.cookieNames.refreshToken, sessionCookieOptions);
}
function isMobileClient(request: Request) {
  return request.headers["x-client-platform"] === "mobile";
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
  const { accessToken, refreshToken, user } = await login(request.body);

  setSessionCookies(response, accessToken, refreshToken);

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
    const { accessToken, refreshToken, user } = await refreshSession(currentRefreshToken);

    setSessionCookies(response, accessToken, refreshToken);

    return sendSuccess(response, {
      message: "Session refreshed successfully",
      data: sessionResponseData(request, { user, accessToken, refreshToken }),
    });
  } catch (error) {
    clearSessionCookies(response);
    throw error;
  }
});

export const postLogout = asyncHandler(async (_request: Request, response: Response) => {
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
