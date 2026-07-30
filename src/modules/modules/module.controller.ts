import type { Request, Response } from "express";

import { uploadImageAsset } from "@/modules/uploads/uploads.service";
import { asyncHandler } from "@/shared/helpers/async-handler";
import { sendSuccess } from "@/shared/helpers/api-response";

import {
  createModule,
  createModuleField,
  deleteModule,
  deleteModuleField,
  getModuleById,
  getModuleFields,
  listModules,
  updateModule,
  updateModuleField,
} from "./module.service";

function getParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value ?? "";
}

async function uploadModuleMedia(request: Request) {
  if (!request.file) return null;
  return uploadImageAsset(request.file, {
    folder: "modules",
    context: "module-media",
    fileName: request.body.name ?? "module-media",
  });
}

export const getModules = asyncHandler(async (request: Request, response: Response) => {
  const search = typeof request.query.search === "string" ? request.query.search : undefined;
  const status = typeof request.query.status === "string" ? request.query.status : undefined;
  const moduleTypeId = typeof request.query.moduleTypeId === "string" ? request.query.moduleTypeId : undefined;
  const page = Number(request.query.page ?? 1);
  const limit = Number(request.query.limit ?? 20);

  const result = await listModules({
    page,
    limit,
    search,
    status,
    moduleTypeId,
    companyId: request.user?.companyId,
    role: request.user?.role,
  });

  return sendSuccess(response, {
    data: result.items,
    meta: result.pagination,
  });
});

export const getModule = asyncHandler(async (request: Request, response: Response) => {
  const result = await getModuleById(getParam(request.params.moduleId));

  return sendSuccess(response, {
    data: result,
  });
});

export const postModule = asyncHandler(async (request: Request, response: Response) => {
  const media = await uploadModuleMedia(request);
  const result = await createModule({
    ...request.body,
    ...(media ? { mediaUrl: media.secureUrl ?? media.url, mediaKey: media.key } : {}),
  });

  return sendSuccess(response, {
    statusCode: 201,
    message: "Module created successfully",
    data: result,
  });
});

export const patchModule = asyncHandler(async (request: Request, response: Response) => {
  const media = await uploadModuleMedia(request);
  const result = await updateModule(getParam(request.params.moduleId), {
    ...request.body,
    ...(media ? { mediaUrl: media.secureUrl ?? media.url, mediaKey: media.key } : {}),
  });

  return sendSuccess(response, {
    message: "Module updated successfully",
    data: result,
  });
});

export const removeModule = asyncHandler(async (request: Request, response: Response) => {
  const result = await deleteModule(getParam(request.params.moduleId));

  return sendSuccess(response, {
    message: "Module deleted successfully",
    data: result,
  });
});

export const getFields = asyncHandler(async (request: Request, response: Response) => {
  const result = await getModuleFields(getParam(request.params.moduleId));

  return sendSuccess(response, {
    data: result,
  });
});

export const postField = asyncHandler(async (request: Request, response: Response) => {
  const result = await createModuleField(
    getParam(request.params.moduleId),
    request.body,
  );

  return sendSuccess(response, {
    statusCode: 201,
    message: "Module field created successfully",
    data: result,
  });
});

export const patchField = asyncHandler(async (request: Request, response: Response) => {
  const result = await updateModuleField(
    getParam(request.params.moduleId),
    getParam(request.params.fieldId),
    request.body,
  );

  return sendSuccess(response, {
    message: "Module field updated successfully",
    data: result,
  });
});

export const removeField = asyncHandler(async (request: Request, response: Response) => {
  const result = await deleteModuleField(
    getParam(request.params.moduleId),
    getParam(request.params.fieldId),
  );

  return sendSuccess(response, {
    message: "Module field deleted successfully",
    data: result,
  });
});
