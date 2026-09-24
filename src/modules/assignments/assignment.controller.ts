import type { Request, Response } from "express";

import { cancelAssignment, createAssignment, getAssignment, listAssignmentExecutors, listAssignments, updateAssignment } from "@/modules/assignments/assignment.service";
import { AppError } from "@/shared/errors/app-error";
import { ERROR_CODES } from "@/shared/errors/error-codes";
import { HTTP_STATUS } from "@/shared/errors/http-status";
import { sendSuccess } from "@/shared/helpers/api-response";
import { asyncHandler } from "@/shared/helpers/async-handler";

function identity(request: Request) {
  const companyId = request.user?.companyId;
  const userId = request.user?.id;
  if (!companyId || !userId) {
    throw new AppError({ message: "No company associated with this account.", statusCode: HTTP_STATUS.FORBIDDEN, errorCode: ERROR_CODES.FORBIDDEN });
  }
  return { companyId, userId };
}

function assignmentIdOf(request: Request) {
  const value = request.params.assignmentId;
  return Array.isArray(value) ? value[0] : String(value);
}

export const getAssignments = asyncHandler(async (request: Request, response: Response) => {
  const { companyId } = identity(request);
  return sendSuccess(response, { data: await listAssignments(companyId, typeof request.query.status === "string" ? request.query.status : undefined) });
});

export const getAssignmentExecutors = asyncHandler(async (request: Request, response: Response) => {
  const { companyId } = identity(request);
  return sendSuccess(response, { data: await listAssignmentExecutors(companyId, typeof request.query.search === "string" ? request.query.search : undefined) });
});

export const getAssignmentDetail = asyncHandler(async (request: Request, response: Response) => {
  const { companyId } = identity(request);
  return sendSuccess(response, { data: await getAssignment(companyId, assignmentIdOf(request)) });
});

export const postAssignment = asyncHandler(async (request: Request, response: Response) => {
  const { companyId, userId } = identity(request);
  return sendSuccess(response, { statusCode: HTTP_STATUS.CREATED, data: await createAssignment(companyId, userId, request.body) });
});

export const patchAssignment = asyncHandler(async (request: Request, response: Response) => {
  const { companyId, userId } = identity(request);
  return sendSuccess(response, { data: await updateAssignment(companyId, assignmentIdOf(request), userId, request.body) });
});

export const patchAssignmentCancelled = asyncHandler(async (request: Request, response: Response) => {
  const { companyId, userId } = identity(request);
  return sendSuccess(response, { data: await cancelAssignment(companyId, assignmentIdOf(request), userId) });
});
