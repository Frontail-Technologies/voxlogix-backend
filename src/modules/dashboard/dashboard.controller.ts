import type { Request, Response } from "express";

import { AppError } from "@/shared/errors/app-error";
import { ERROR_CODES } from "@/shared/errors/error-codes";
import { HTTP_STATUS } from "@/shared/errors/http-status";
import { sendSuccess } from "@/shared/helpers/api-response";
import { asyncHandler } from "@/shared/helpers/async-handler";

import { getAdminDashboardSummary, getExecutionDashboardSummary } from "./dashboard.service";

export const getDashboardSummary = asyncHandler(
  async (request: Request, response: Response) => {
    const companyId = request.user?.companyId;

    if (!companyId) {
      throw new AppError({
        message: "No company associated with this account.",
        statusCode: HTTP_STATUS.FORBIDDEN,
        errorCode: ERROR_CODES.FORBIDDEN,
      });
    }

    const summary = await getAdminDashboardSummary(companyId);

    return sendSuccess(response, { data: summary });
  },
);

export const getExecutionSummary = asyncHandler(
  async (request: Request, response: Response) => {
    const companyId = request.user?.companyId;
    const userId = request.user?.id;

    if (!companyId || !userId) {
      throw new AppError({
        message: "No company associated with this account.",
        statusCode: HTTP_STATUS.FORBIDDEN,
        errorCode: ERROR_CODES.FORBIDDEN,
      });
    }

    const summary = await getExecutionDashboardSummary(companyId, userId);

    return sendSuccess(response, { data: summary });
  },
);
