import type { Request, Response } from "express";

import { getUnreadNotificationCount, listNotifications, markAllNotificationsRead, markNotificationRead, sendAdminNotification } from "@/modules/notifications/notification.service";
import { AppError } from "@/shared/errors/app-error";
import { ERROR_CODES } from "@/shared/errors/error-codes";
import { HTTP_STATUS } from "@/shared/errors/http-status";
import { sendSuccess } from "@/shared/helpers/api-response";
import { asyncHandler } from "@/shared/helpers/async-handler";

function identity(request: Request) {
  const companyId = request.user?.companyId;
  const userId = request.user?.id;
  if (!companyId || !userId) throw new AppError({ message: "No company associated with this account.", statusCode: HTTP_STATUS.FORBIDDEN, errorCode: ERROR_CODES.FORBIDDEN });
  return { companyId, userId };
}

export const getNotifications = asyncHandler(async (request: Request, response: Response) => {
  const { companyId, userId } = identity(request);
  const rawLimit = typeof request.query.limit === "string" ? Number(request.query.limit) : undefined;
  return sendSuccess(response, { data: await listNotifications(companyId, userId, Number.isFinite(rawLimit) ? rawLimit : undefined) });
});

export const getUnreadCount = asyncHandler(async (request: Request, response: Response) => {
  const { companyId, userId } = identity(request);
  return sendSuccess(response, { data: { count: await getUnreadNotificationCount(companyId, userId) } });
});

export const patchNotificationRead = asyncHandler(async (request: Request, response: Response) => {
  const { companyId, userId } = identity(request);
  return sendSuccess(response, { data: await markNotificationRead(companyId, userId, String(request.params.notificationId)) });
});

export const patchAllNotificationsRead = asyncHandler(async (request: Request, response: Response) => {
  const { companyId, userId } = identity(request);
  return sendSuccess(response, { data: await markAllNotificationsRead(companyId, userId) });
});

export const postAdminNotification = asyncHandler(async (request: Request, response: Response) => {
  const { companyId, userId } = identity(request);
  return sendSuccess(response, { statusCode: HTTP_STATUS.CREATED, data: await sendAdminNotification(companyId, userId, request.body) });
});
