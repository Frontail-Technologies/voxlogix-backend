import type { Request, Response } from "express";

import {
  createMeterCounterReading,
  listMeterCounterLookup,
  listMeterCounterReadings,
} from "@/modules/meter-counters/meter-counter.service";
import { HTTP_STATUS } from "@/shared/errors/http-status";
import { sendSuccess } from "@/shared/helpers/api-response";
import { asyncHandler } from "@/shared/helpers/async-handler";

function companyIdOf(request: Request) {
  return String(request.user?.companyId ?? "");
}

function userNameOf(request: Request) {
  return request.user?.email ?? "System";
}

function paramOf(request: Request, name: string) {
  const value = request.params[name];
  return Array.isArray(value) ? value[0] : String(value);
}

export const getMeterCounterLookup = asyncHandler(async (request: Request, response: Response) => {
  const result = await listMeterCounterLookup({
    companyId: companyIdOf(request),
    page: Number(request.query.page ?? 1),
    limit: Number(request.query.limit ?? 20),
    search: typeof request.query.search === "string" ? request.query.search : undefined,
    counterCode: typeof request.query.counterCode === "string" ? request.query.counterCode : undefined,
  });

  return sendSuccess(response, { data: result.items, meta: result.pagination });
});

export const postMeterCounterReading = asyncHandler(async (request: Request, response: Response) => {
  const reading = await createMeterCounterReading({
    companyId: companyIdOf(request),
    counterId: paramOf(request, "counterId"),
    reportedById: request.user?.id,
    reportedByName: userNameOf(request),
    ...request.body,
  });

  return sendSuccess(response, { statusCode: HTTP_STATUS.CREATED, data: reading });
});

export const getMeterCounterReadings = asyncHandler(async (request: Request, response: Response) => {
  const result = await listMeterCounterReadings(
    companyIdOf(request),
    paramOf(request, "counterId"),
    Number(request.query.page ?? 1),
    Number(request.query.limit ?? 20),
  );

  return sendSuccess(response, { data: result.items, meta: result.pagination });
});
