import type { Request, Response } from "express";

import {
  createEquipmentManual,
  deleteEquipmentManual,
  getEquipmentManual,
  listEquipmentManuals,
  updateEquipmentManual,
} from "@/modules/equipment-manuals/equipment-manual.service";
import { uploadDocumentAsset } from "@/modules/uploads/uploads.service";
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

function extensionFromFileName(fileName: string) {
  const match = fileName.match(/\.[a-z0-9]+$/i);
  return match?.[0] ?? "";
}

function documentUploadFileName(request: Request, fallbackName: string) {
  const extension = request.file?.originalname ? extensionFromFileName(request.file.originalname) : "";
  return extension && !fallbackName.toLowerCase().endsWith(extension.toLowerCase())
    ? `${fallbackName}${extension}`
    : fallbackName;
}
function manualSourceFileFromRequest(request: Request) {
  if (!request.file) return null;
  return {
    buffer: request.file.buffer,
    mimeType: request.file.mimetype,
    originalName: request.file.originalname,
  };
}

async function manualAssetFromRequest(request: Request, fallbackName: string) {
  if (!request.file) {
    return null;
  }

  return uploadDocumentAsset(request.file, {
    folder: "equipment-manuals",
    context: "equipment-manual",
    fileName: documentUploadFileName(request, fallbackName),
  });
}

export const getEquipmentManualsList = asyncHandler(async (request: Request, response: Response) => {
  const result = await listEquipmentManuals({
    companyId: companyIdOf(request),
    page: Number(request.query.page ?? 1),
    limit: Number(request.query.limit ?? 20),
    search: typeof request.query.search === "string" ? request.query.search : undefined,
    equipmentId: typeof request.query.equipmentId === "string" ? request.query.equipmentId : undefined,
    status: typeof request.query.status === "string" ? request.query.status : undefined,
  });

  return sendSuccess(response, { data: result.items, meta: result.pagination });
});

export const getEquipmentManualDetail = asyncHandler(async (request: Request, response: Response) => {
  return sendSuccess(response, {
    data: await getEquipmentManual(companyIdOf(request), paramOf(request, "manualId")),
  });
});

export const postEquipmentManual = asyncHandler(async (request: Request, response: Response) => {
  const asset = await manualAssetFromRequest(request, request.body.title ?? "equipment-manual");
  const manual = await createEquipmentManual({
    companyId: companyIdOf(request),
    createdById: request.user?.id,
    ...request.body,
  }, asset, manualSourceFileFromRequest(request));

  return sendSuccess(response, { statusCode: HTTP_STATUS.CREATED, data: manual });
});

export const patchEquipmentManual = asyncHandler(async (request: Request, response: Response) => {
  const asset = await manualAssetFromRequest(request, request.body.title ?? paramOf(request, "manualId"));

  return sendSuccess(response, {
    data: await updateEquipmentManual(companyIdOf(request), paramOf(request, "manualId"), request.body, asset, manualSourceFileFromRequest(request)),
  });
});

export const removeEquipmentManual = asyncHandler(async (request: Request, response: Response) => {
  return sendSuccess(response, {
    data: await deleteEquipmentManual(companyIdOf(request), paramOf(request, "manualId")),
  });
});
