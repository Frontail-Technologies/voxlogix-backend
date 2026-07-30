import type { Request, Response } from "express";

import {
  createModuleType,
  deleteModuleType,
  getModuleType,
  listModuleTypes,
  updateModuleType,
} from "@/modules/module-types/module-type.service";
import { HTTP_STATUS } from "@/shared/errors/http-status";
import { sendSuccess } from "@/shared/helpers/api-response";
import { asyncHandler } from "@/shared/helpers/async-handler";

function paramOf(request: Request, name: string) {
  const value = request.params[name];
  return Array.isArray(value) ? value[0] : String(value);
}

export const getModuleTypes = asyncHandler(async (request: Request, response: Response) => {
  const result = await listModuleTypes({
    page: Number(request.query.page ?? 1),
    limit: Number(request.query.limit ?? 20),
    search: typeof request.query.search === "string" ? request.query.search : undefined,
    status: typeof request.query.status === "string" ? request.query.status : undefined,
  });

  return sendSuccess(response, { data: result.items, meta: result.pagination });
});

export const getModuleTypeDetail = asyncHandler(async (request: Request, response: Response) =>
  sendSuccess(response, { data: await getModuleType(paramOf(request, "moduleTypeId")) }),
);

export const postModuleType = asyncHandler(async (request: Request, response: Response) =>
  sendSuccess(response, {
    statusCode: HTTP_STATUS.CREATED,
    data: await createModuleType(request.body),
  }),
);

export const patchModuleType = asyncHandler(async (request: Request, response: Response) =>
  sendSuccess(response, {
    data: await updateModuleType(paramOf(request, "moduleTypeId"), request.body),
  }),
);

export const removeModuleType = asyncHandler(async (request: Request, response: Response) =>
  sendSuccess(response, { data: await deleteModuleType(paramOf(request, "moduleTypeId")) }),
);
