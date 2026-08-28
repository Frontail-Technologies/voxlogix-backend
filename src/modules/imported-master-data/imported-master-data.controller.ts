import type { Request, Response } from "express";

import {
  deleteKaizenCategory,
  deleteMeasuringPoint,
  deleteMeterCounter,
  deleteSafetyReporting,
  listKaizenCategories,
  listMeasuringPoints,
  listMeterCounters,
  listSafetyReporting,
  updateKaizenCategory,
  updateMeasuringPoint,
  updateMeterCounter,
  updateSafetyReporting,
} from "@/modules/imported-master-data/imported-master-data.service";
// Reused as-is: same reading-history query the mobile API already exposes at
// /measuring-points/:id/readings and /meter-counters/:id/readings. Exposed
// again here under /imported-master-data so the admin web panel (which only
// otherwise talks to /imported-master-data/*) doesn't need to know about a
// second, mobile-facing route prefix.
import { listMeasuringPointReadings } from "@/modules/measuring-points/measuring-point.service";
import { listMeterCounterReadings } from "@/modules/meter-counters/meter-counter.service";
import { sendSuccess } from "@/shared/helpers/api-response";
import { asyncHandler } from "@/shared/helpers/async-handler";

function companyIdOf(request: Request) { return String(request.user?.companyId ?? ""); }
function idParam(request: Request) { return String(request.params.id); }
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
export const patchSafetyReporting = asyncHandler(async (request: Request, response: Response) =>
  sendSuccess(response, { data: await updateSafetyReporting(companyIdOf(request), idParam(request), request.body) }));
export const removeSafetyReporting = asyncHandler(async (request: Request, response: Response) =>
  sendSuccess(response, { data: await deleteSafetyReporting(companyIdOf(request), idParam(request)) }));

export const getMeasuringPoints = asyncHandler(async (request: Request, response: Response) => {
  const result = await listMeasuringPoints(listInput(request));
  return sendSuccess(response, { data: result.items, meta: result.pagination });
});
export const patchMeasuringPoint = asyncHandler(async (request: Request, response: Response) =>
  sendSuccess(response, { data: await updateMeasuringPoint(companyIdOf(request), idParam(request), request.body) }));
export const removeMeasuringPoint = asyncHandler(async (request: Request, response: Response) =>
  sendSuccess(response, { data: await deleteMeasuringPoint(companyIdOf(request), idParam(request)) }));
export const getMeasuringPointReadingHistory = asyncHandler(async (request: Request, response: Response) => {
  const result = await listMeasuringPointReadings(companyIdOf(request), idParam(request), Number(request.query.page ?? 1), Number(request.query.limit ?? 30));
  return sendSuccess(response, { data: result.items, meta: result.pagination });
});

export const getMeterCounters = asyncHandler(async (request: Request, response: Response) => {
  const result = await listMeterCounters(listInput(request));
  return sendSuccess(response, { data: result.items, meta: result.pagination });
});
export const patchMeterCounter = asyncHandler(async (request: Request, response: Response) =>
  sendSuccess(response, { data: await updateMeterCounter(companyIdOf(request), idParam(request), request.body) }));
export const removeMeterCounter = asyncHandler(async (request: Request, response: Response) =>
  sendSuccess(response, { data: await deleteMeterCounter(companyIdOf(request), idParam(request)) }));
export const getMeterCounterReadingHistory = asyncHandler(async (request: Request, response: Response) => {
  const result = await listMeterCounterReadings(companyIdOf(request), idParam(request), Number(request.query.page ?? 1), Number(request.query.limit ?? 30));
  return sendSuccess(response, { data: result.items, meta: result.pagination });
});

export const getKaizenCategories = asyncHandler(async (request: Request, response: Response) => {
  const result = await listKaizenCategories(listInput(request));
  return sendSuccess(response, { data: result.items, meta: result.pagination });
});
export const patchKaizenCategory = asyncHandler(async (request: Request, response: Response) =>
  sendSuccess(response, { data: await updateKaizenCategory(companyIdOf(request), idParam(request), request.body) }));
export const removeKaizenCategory = asyncHandler(async (request: Request, response: Response) =>
  sendSuccess(response, { data: await deleteKaizenCategory(companyIdOf(request), idParam(request)) }));
