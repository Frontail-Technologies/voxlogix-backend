import type { Request, Response } from "express";

import {
  createEquipment,
  deleteEquipment,
  getEquipment,
  listEquipment,
  updateEquipment,
} from "@/modules/equipment/equipment.service";
import { uploadImageAsset } from "@/modules/uploads/uploads.service";
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

async function imageUrlFromRequest(request: Request, fallbackName: string) {
  if (!request.file) {
    return undefined;
  }

  const result = await uploadImageAsset(request.file, {
    folder: "equipment",
    context: "generic-image",
    fileName: fallbackName,
  });

  return result.secureUrl ?? result.url;
}

export const getEquipmentList = asyncHandler(async (request: Request, response: Response) => {
  const result = await listEquipment({
    companyId: companyIdOf(request),
    page: Number(request.query.page ?? 1),
    limit: Number(request.query.limit ?? 20),
    search: typeof request.query.search === "string" ? request.query.search : undefined,
    status: typeof request.query.status === "string" ? request.query.status : undefined,
    criticality: typeof request.query.criticality === "string" ? request.query.criticality : undefined,
    section: typeof request.query.section === "string" ? request.query.section : undefined,
  });

  return sendSuccess(response, { data: result.items, meta: result.pagination });
});

export const getEquipmentDetail = asyncHandler(async (request: Request, response: Response) => {
  return sendSuccess(response, {
    data: await getEquipment(companyIdOf(request), paramOf(request, "equipmentId")),
  });
});

export const postEquipment = asyncHandler(async (request: Request, response: Response) => {
  const imageUrl = await imageUrlFromRequest(request, request.body.equipmentCode ?? request.body.name ?? "equipment");
  const equipment = await createEquipment({
    companyId: companyIdOf(request),
    ...request.body,
    ...(imageUrl ? { imageUrl } : {}),
  });
  return sendSuccess(response, { statusCode: HTTP_STATUS.CREATED, data: equipment });
});

export const patchEquipment = asyncHandler(async (request: Request, response: Response) => {
  const imageUrl = await imageUrlFromRequest(request, request.body.equipmentCode ?? request.body.name ?? paramOf(request, "equipmentId"));

  return sendSuccess(response, {
    data: await updateEquipment(companyIdOf(request), paramOf(request, "equipmentId"), {
      ...request.body,
      ...(imageUrl ? { imageUrl } : {}),
    }),
  });
});

export const removeEquipment = asyncHandler(async (request: Request, response: Response) => {
  return sendSuccess(response, {
    data: await deleteEquipment(companyIdOf(request), paramOf(request, "equipmentId")),
  });
});
