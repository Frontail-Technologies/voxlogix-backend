import type { Request, Response } from "express";

import {
  addLogAttachment,
  createLog,
  deleteLogAttachment,
  getLog,
  listLogs,
  updateLog,
  updateLogStatus,
} from "@/modules/logs/log.service";
import { HTTP_STATUS } from "@/shared/errors/http-status";
import { sendSuccess } from "@/shared/helpers/api-response";
import { asyncHandler } from "@/shared/helpers/async-handler";
import { USER_ROLES } from "@/shared/constants";

function companyIdOf(request: Request) {
  return String(request.user?.companyId ?? "");
}

function paramOf(request: Request, name: string) {
  const value = request.params[name];
  return Array.isArray(value) ? value[0] : String(value);
}

function userNameOf(request: Request) {
  return request.user?.email ?? "System";
}

export const getLogs = asyncHandler(async (request: Request, response: Response) => {
  const scope = typeof request.query.scope === "string" ? request.query.scope : undefined;
  const requestedCreatedById = typeof request.query.createdById === "string" ? request.query.createdById : undefined;
  const createdById =
    scope === "feed"
      ? undefined
      : scope === "mine" || request.user?.role === USER_ROLES.EXECUTION
      ? request.user?.id
      : requestedCreatedById;

  const result = await listLogs({
    companyId: companyIdOf(request),
    page: Number(request.query.page ?? 1),
    limit: Number(request.query.limit ?? 20),
    search: typeof request.query.search === "string" ? request.query.search : undefined,
    status: typeof request.query.status === "string" ? request.query.status : undefined,
    severity: typeof request.query.severity === "string" ? request.query.severity : undefined,
    moduleType: typeof request.query.moduleType === "string" ? request.query.moduleType : undefined,
    equipmentId: typeof request.query.equipmentId === "string" ? request.query.equipmentId : undefined,
    createdById,
    scope: scope === "feed" || scope === "mine" ? scope : undefined,
    dateFrom: request.query.dateFrom ? new Date(String(request.query.dateFrom)) : undefined,
    dateTo: request.query.dateTo ? new Date(String(request.query.dateTo)) : undefined,
  });

  return sendSuccess(response, { data: result.items, meta: result.pagination });
});

export const getLogDetail = asyncHandler(async (request: Request, response: Response) => {
  return sendSuccess(response, { data: await getLog(companyIdOf(request), paramOf(request, "logId")) });
});

export const postLog = asyncHandler(async (request: Request, response: Response) => {
  const log = await createLog({
    ...request.body,
    companyId: companyIdOf(request),
    createdById: request.user?.id,
    createdByName: userNameOf(request),
  });
  return sendSuccess(response, { statusCode: HTTP_STATUS.CREATED, data: log });
});

export const patchLog = asyncHandler(async (request: Request, response: Response) => {
  return sendSuccess(response, { data: await updateLog(companyIdOf(request), paramOf(request, "logId"), request.body) });
});

export const patchLogStatus = asyncHandler(async (request: Request, response: Response) => {
  return sendSuccess(response, {
    data: await updateLogStatus(companyIdOf(request), paramOf(request, "logId"), {
      actorId: request.user?.id,
      actorName: userNameOf(request),
      ...request.body,
    }),
  });
});

export const postLogAttachment = asyncHandler(async (request: Request, response: Response) => {
  return sendSuccess(response, {
    statusCode: HTTP_STATUS.CREATED,
    data: await addLogAttachment(companyIdOf(request), paramOf(request, "logId"), request.body),
  });
});

export const removeLogAttachment = asyncHandler(async (request: Request, response: Response) => {
  return sendSuccess(response, {
    data: await deleteLogAttachment(companyIdOf(request), paramOf(request, "logId"), paramOf(request, "attachmentId")),
  });
});
