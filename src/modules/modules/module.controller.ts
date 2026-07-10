import type { Request, Response } from "express";

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

export const getModules = asyncHandler(async (request: Request, response: Response) => {
  const search = typeof request.query.search === "string" ? request.query.search : undefined;
  const status = typeof request.query.status === "string" ? request.query.status : undefined;
  const type = typeof request.query.type === "string" ? request.query.type : undefined;
  const page = Number(request.query.page ?? 1);
  const limit = Number(request.query.limit ?? 20);

  const result = await listModules({ page, limit, search, status, type });

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
  const result = await createModule(request.body);

  return sendSuccess(response, {
    statusCode: 201,
    message: "Module created successfully",
    data: result,
  });
});

export const patchModule = asyncHandler(async (request: Request, response: Response) => {
  const result = await updateModule(getParam(request.params.moduleId), request.body);

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
