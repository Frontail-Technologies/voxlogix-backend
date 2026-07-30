import type { Request, Response } from "express";

import { createLocation, deleteLocation, getLocation, listLocations, updateLocation } from "@/modules/locations/location.service";
import { HTTP_STATUS } from "@/shared/errors/http-status";
import { sendSuccess } from "@/shared/helpers/api-response";
import { asyncHandler } from "@/shared/helpers/async-handler";

function companyIdOf(request: Request) {
  return String(request.user?.companyId ?? "");
}

function paramOf(request: Request, name: string) {
  const value = request.params[name];
  return Array.isArray(value) ? value[0] : String(value);
}

export const getLocations = asyncHandler(async (request: Request, response: Response) => {
  const result = await listLocations({
    companyId: companyIdOf(request),
    page: Number(request.query.page ?? 1),
    limit: Number(request.query.limit ?? 20),
    search: typeof request.query.search === "string" ? request.query.search : undefined,
    status: typeof request.query.status === "string" ? request.query.status : undefined,
  });
  return sendSuccess(response, { data: result.items, meta: result.pagination });
});
export const getLocationDetail = asyncHandler(async (request: Request, response: Response) => sendSuccess(response, { data: await getLocation(companyIdOf(request), paramOf(request, "locationId")) }));
export const postLocation = asyncHandler(async (request: Request, response: Response) => sendSuccess(response, { statusCode: HTTP_STATUS.CREATED, data: await createLocation(companyIdOf(request), request.body) }));
export const patchLocation = asyncHandler(async (request: Request, response: Response) => sendSuccess(response, { data: await updateLocation(companyIdOf(request), paramOf(request, "locationId"), request.body) }));
export const removeLocation = asyncHandler(async (request: Request, response: Response) => sendSuccess(response, { data: await deleteLocation(companyIdOf(request), paramOf(request, "locationId")) }));

