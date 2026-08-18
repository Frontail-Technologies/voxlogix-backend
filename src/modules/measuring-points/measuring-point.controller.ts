import type { Request, Response } from "express";

import {
  createMeasuringPointReading,
  listMeasuringPointLookup,
  listMeasuringPointReadings,
} from "@/modules/measuring-points/measuring-point.service";
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

export const getMeasuringPointLookup = asyncHandler(async (request: Request, response: Response) => {
  const result = await listMeasuringPointLookup({
    companyId: companyIdOf(request),
    page: Number(request.query.page ?? 1),
    limit: Number(request.query.limit ?? 20),
    search: typeof request.query.search === "string" ? request.query.search : undefined,
    pointCode: typeof request.query.pointCode === "string" ? request.query.pointCode : undefined,
  });

  return sendSuccess(response, { data: result.items, meta: result.pagination });
});

export const postMeasuringPointReading = asyncHandler(async (request: Request, response: Response) => {
  const reading = await createMeasuringPointReading({
    companyId: companyIdOf(request),
    pointId: paramOf(request, "pointId"),
    reportedById: request.user?.id,
    reportedByName: userNameOf(request),
    ...request.body,
  });

  return sendSuccess(response, { statusCode: HTTP_STATUS.CREATED, data: reading });
});

export const getMeasuringPointReadings = asyncHandler(async (request: Request, response: Response) => {
  const result = await listMeasuringPointReadings(
    companyIdOf(request),
    paramOf(request, "pointId"),
    Number(request.query.page ?? 1),
    Number(request.query.limit ?? 20),
  );

  return sendSuccess(response, { data: result.items, meta: result.pagination });
});
