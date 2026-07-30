import type { Request, Response } from "express";

import { listKaizenCategories, listMeasuringPoints, listMeterCounters, listSafetyReporting } from "@/modules/imported-master-data/imported-master-data.service";
import { sendSuccess } from "@/shared/helpers/api-response";
import { asyncHandler } from "@/shared/helpers/async-handler";

function companyIdOf(request: Request) { return String(request.user?.companyId ?? ""); }
function listInput(request: Request) {
  return {
    companyId: companyIdOf(request),
    page: Number(request.query.page ?? 1),
    limit: Number(request.query.limit ?? 20),
    search: typeof request.query.search === "string" ? request.query.search : undefined,
    status: typeof request.query.status === "string" ? request.query.status : undefined,
  };
}

export const getSafetyReporting = asyncHandler(async (request: Request, response: Response) => {
  const result = await listSafetyReporting(listInput(request));
  return sendSuccess(response, { data: result.items, meta: result.pagination });
});
export const getMeasuringPoints = asyncHandler(async (request: Request, response: Response) => {
  const result = await listMeasuringPoints(listInput(request));
  return sendSuccess(response, { data: result.items, meta: result.pagination });
});
export const getMeterCounters = asyncHandler(async (request: Request, response: Response) => {
  const result = await listMeterCounters(listInput(request));
  return sendSuccess(response, { data: result.items, meta: result.pagination });
});
export const getKaizenCategories = asyncHandler(async (request: Request, response: Response) => {
  const result = await listKaizenCategories(listInput(request));
  return sendSuccess(response, { data: result.items, meta: result.pagination });
});
