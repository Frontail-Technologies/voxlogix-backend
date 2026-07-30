import type { Request, Response } from "express";

import {
  createModuleCategory,
  deleteModuleCategory,
  getModuleCategory,
  listModuleCategories,
  updateModuleCategory,
} from "@/modules/module-categories/module-category.service";
import { HTTP_STATUS } from "@/shared/errors/http-status";
import { sendSuccess } from "@/shared/helpers/api-response";
import { asyncHandler } from "@/shared/helpers/async-handler";

function paramOf(request: Request, name: string) {
  const value = request.params[name];
  return Array.isArray(value) ? value[0] : String(value);
}

export const getModuleCategories = asyncHandler(async (request: Request, response: Response) => {
  const result = await listModuleCategories({
    page: Number(request.query.page ?? 1),
    limit: Number(request.query.limit ?? 20),
    search: typeof request.query.search === "string" ? request.query.search : undefined,
    status: typeof request.query.status === "string" ? request.query.status : undefined,
  });

  return sendSuccess(response, { data: result.items, meta: result.pagination });
});

export const getModuleCategoryDetail = asyncHandler(async (request: Request, response: Response) =>
  sendSuccess(response, { data: await getModuleCategory(paramOf(request, "moduleCategoryId")) }),
);

export const postModuleCategory = asyncHandler(async (request: Request, response: Response) =>
  sendSuccess(response, {
    statusCode: HTTP_STATUS.CREATED,
    data: await createModuleCategory(request.body),
  }),
);

export const patchModuleCategory = asyncHandler(async (request: Request, response: Response) =>
  sendSuccess(response, {
    data: await updateModuleCategory(paramOf(request, "moduleCategoryId"), request.body),
  }),
);

export const removeModuleCategory = asyncHandler(async (request: Request, response: Response) =>
  sendSuccess(response, { data: await deleteModuleCategory(paramOf(request, "moduleCategoryId")) }),
);
