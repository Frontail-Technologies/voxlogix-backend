import type { Request, Response } from "express";

import { createEquipmentCategory, deleteEquipmentCategory, getEquipmentCategory, listEquipmentCategories, updateEquipmentCategory } from "@/modules/equipment-categories/equipment-category.service";
import { HTTP_STATUS } from "@/shared/errors/http-status";
import { sendSuccess } from "@/shared/helpers/api-response";
import { asyncHandler } from "@/shared/helpers/async-handler";

function companyIdOf(request: Request) { return String(request.user?.companyId ?? ""); }
function paramOf(request: Request, name: string) { const value = request.params[name]; return Array.isArray(value) ? value[0] : String(value); }
export const getEquipmentCategoriesHandler = asyncHandler(async (request: Request, response: Response) => {
  const result = await listEquipmentCategories({
    companyId: companyIdOf(request),
    page: Number(request.query.page ?? 1),
    limit: Number(request.query.limit ?? 20),
    search: typeof request.query.search === "string" ? request.query.search : undefined,
    status: typeof request.query.status === "string" ? request.query.status : undefined,
  });
  return sendSuccess(response, { data: result.items, meta: result.pagination });
});
export const getEquipmentCategoryDetail = asyncHandler(async (request: Request, response: Response) => sendSuccess(response, { data: await getEquipmentCategory(companyIdOf(request), paramOf(request, "equipmentCategoryId")) }));
export const postEquipmentCategory = asyncHandler(async (request: Request, response: Response) => sendSuccess(response, { statusCode: HTTP_STATUS.CREATED, data: await createEquipmentCategory(companyIdOf(request), request.body) }));
export const patchEquipmentCategory = asyncHandler(async (request: Request, response: Response) => sendSuccess(response, { data: await updateEquipmentCategory(companyIdOf(request), paramOf(request, "equipmentCategoryId"), request.body) }));
export const removeEquipmentCategory = asyncHandler(async (request: Request, response: Response) => sendSuccess(response, { data: await deleteEquipmentCategory(companyIdOf(request), paramOf(request, "equipmentCategoryId")) }));
