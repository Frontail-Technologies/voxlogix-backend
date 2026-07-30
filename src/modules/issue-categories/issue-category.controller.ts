import type { Request, Response } from "express";

import { createIssueCategory, deleteIssueCategory, getIssueCategory, listIssueCategories, updateIssueCategory } from "@/modules/issue-categories/issue-category.service";
import { HTTP_STATUS } from "@/shared/errors/http-status";
import { sendSuccess } from "@/shared/helpers/api-response";
import { asyncHandler } from "@/shared/helpers/async-handler";

function companyIdOf(request: Request) { return String(request.user?.companyId ?? ""); }
function paramOf(request: Request, name: string) { const value = request.params[name]; return Array.isArray(value) ? value[0] : String(value); }
export const getIssueCategories = asyncHandler(async (request: Request, response: Response) => {
  const result = await listIssueCategories({
    companyId: companyIdOf(request),
    page: Number(request.query.page ?? 1),
    limit: Number(request.query.limit ?? 20),
    search: typeof request.query.search === "string" ? request.query.search : undefined,
    moduleType: typeof request.query.moduleType === "string" ? request.query.moduleType : undefined,
    status: typeof request.query.status === "string" ? request.query.status : undefined,
  });
  return sendSuccess(response, { data: result.items, meta: result.pagination });
});
export const getIssueCategoryDetail = asyncHandler(async (request: Request, response: Response) => sendSuccess(response, { data: await getIssueCategory(companyIdOf(request), paramOf(request, "issueCategoryId")) }));
export const postIssueCategory = asyncHandler(async (request: Request, response: Response) => sendSuccess(response, { statusCode: HTTP_STATUS.CREATED, data: await createIssueCategory(companyIdOf(request), request.body) }));
export const patchIssueCategory = asyncHandler(async (request: Request, response: Response) => sendSuccess(response, { data: await updateIssueCategory(companyIdOf(request), paramOf(request, "issueCategoryId"), request.body) }));
export const removeIssueCategory = asyncHandler(async (request: Request, response: Response) => sendSuccess(response, { data: await deleteIssueCategory(companyIdOf(request), paramOf(request, "issueCategoryId")) }));

