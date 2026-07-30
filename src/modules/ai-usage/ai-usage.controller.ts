import type { Request, Response } from "express";

import {
  getUsageCompanyDetail,
  getUsageOverview,
  listUsageByCompany,
} from "@/modules/ai-usage/ai-usage.service";
import type { UsageOverviewInput } from "@/modules/ai-usage/ai-usage.types";
import { sendSuccess } from "@/shared/helpers/api-response";
import { asyncHandler } from "@/shared/helpers/async-handler";

function getParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value ?? "";
}

function getPeriod(
  value: unknown,
): UsageOverviewInput["period"] {
  if (
    value === "THIS_MONTH" ||
    value === "LAST_MONTH" ||
    value === "THIS_QUARTER"
  ) {
    return value;
  }

  return undefined;
}

function getMonth(value: unknown) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 1 && parsed <= 12 ? parsed : undefined;
}

function getYear(value: unknown) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 2020 && parsed <= 2100 ? parsed : undefined;
}

export const getAiUsageOverview = asyncHandler(
  async (request: Request, response: Response) => {
    const period = getPeriod(request.query.period);
    const month = getMonth(request.query.month);
    const year = getYear(request.query.year);
    const result = await getUsageOverview({ period, month, year });

    return sendSuccess(response, {
      data: result,
    });
  },
);

export const getAiUsageCompanies = asyncHandler(
  async (request: Request, response: Response) => {
    const period = getPeriod(request.query.period);
    const month = getMonth(request.query.month);
    const year = getYear(request.query.year);
    const companyId =
      typeof request.query.companyId === "string" ? request.query.companyId : undefined;
    const page = Number(request.query.page ?? 1);
    const limit = Number(request.query.limit ?? 20);

    const result = await listUsageByCompany({ page, limit, period, month, year, companyId });

    return sendSuccess(response, {
      data: result.items,
      meta: result.pagination,
    });
  },
);

export const getAiUsageCompany = asyncHandler(
  async (request: Request, response: Response) => {
    const period = getPeriod(request.query.period);
    const month = getMonth(request.query.month);
    const year = getYear(request.query.year);
    const result = await getUsageCompanyDetail(getParam(request.params.companyId), {
      period,
      month,
      year,
    });

    return sendSuccess(response, {
      data: result,
    });
  },
);
