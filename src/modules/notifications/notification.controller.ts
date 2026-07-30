import type { Request, Response } from "express";

import { AppError } from "@/shared/errors/app-error";
import { ERROR_CODES } from "@/shared/errors/error-codes";
import { HTTP_STATUS } from "@/shared/errors/http-status";
import { sendSuccess } from "@/shared/helpers/api-response";
import { asyncHandler } from "@/shared/helpers/async-handler";

import { listNotifications } from "./notification.service";

export const getNotifications = asyncHandler(async (request: Request, response: Response) => {
  const companyId = request.user?.companyId;
  const userId = request.user?.id;

  if (!companyId || !userId) {
    throw new AppError({
      message: "No company associated with this account.",
      statusCode: HTTP_STATUS.FORBIDDEN,
      errorCode: ERROR_CODES.FORBIDDEN,
    });
  }

  const rawLimit = typeof request.query.limit === "string" ? Number(request.query.limit) : undefined;
  const limit = Number.isFinite(rawLimit) ? rawLimit : undefined;

  const notifications = await listNotifications(companyId, userId, limit);

  return sendSuccess(response, { data: notifications });
});
