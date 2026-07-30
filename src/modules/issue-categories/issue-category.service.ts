import { and, asc, count, eq, ilike, type SQL } from "drizzle-orm";

import { db } from "@/db";
import { issueCategories } from "@/db/schema";
import { AppError } from "@/shared/errors/app-error";
import { ERROR_CODES } from "@/shared/errors/error-codes";
import { HTTP_STATUS } from "@/shared/errors/http-status";
import { buildPagination } from "@/shared/helpers/pagination";

type ListInput = { companyId: string; page: number; limit: number; search?: string; moduleType?: string; status?: string };
function whereFor(input: Omit<ListInput, "page" | "limit">) {
  const filters: SQL<unknown>[] = [eq(issueCategories.companyId, input.companyId)];
  if (input.search) filters.push(ilike(issueCategories.name, `%${input.search}%`));
  if (input.moduleType) filters.push(eq(issueCategories.moduleType, input.moduleType));
  if (input.status) filters.push(eq(issueCategories.status, input.status));
  return and(...filters);
}
async function ensureCategory(companyId: string, issueCategoryId: string) {
  const [existing] = await db.select({ id: issueCategories.id }).from(issueCategories).where(and(eq(issueCategories.id, issueCategoryId), eq(issueCategories.companyId, companyId))).limit(1);
  if (!existing) throw new AppError({ message: "Issue category not found.", statusCode: HTTP_STATUS.NOT_FOUND, errorCode: ERROR_CODES.NOT_FOUND });
}
export async function listIssueCategories(input: ListInput) {
  const where = whereFor(input);
  const [{ totalItems }] = await db.select({ totalItems: count() }).from(issueCategories).where(where);
  const pagination = buildPagination({ page: input.page, limit: input.limit, totalItems });
  const items = await db.select().from(issueCategories).where(where).orderBy(asc(issueCategories.name)).limit(pagination.limit).offset(pagination.offset);
  return { items, pagination };
}
export async function getIssueCategory(companyId: string, issueCategoryId: string) {
  const [item] = await db.select().from(issueCategories).where(and(eq(issueCategories.id, issueCategoryId), eq(issueCategories.companyId, companyId))).limit(1);
  if (!item) throw new AppError({ message: "Issue category not found.", statusCode: HTTP_STATUS.NOT_FOUND, errorCode: ERROR_CODES.NOT_FOUND });
  return item;
}
export async function createIssueCategory(companyId: string, input: typeof issueCategories.$inferInsert) {
  const [created] = await db.insert(issueCategories).values({ ...input, companyId, updatedAt: new Date() }).returning({ id: issueCategories.id });
  return getIssueCategory(companyId, created.id);
}
export async function updateIssueCategory(companyId: string, issueCategoryId: string, input: Partial<typeof issueCategories.$inferInsert>) {
  await ensureCategory(companyId, issueCategoryId);
  await db.update(issueCategories).set({ ...input, updatedAt: new Date() }).where(and(eq(issueCategories.id, issueCategoryId), eq(issueCategories.companyId, companyId)));
  return getIssueCategory(companyId, issueCategoryId);
}
export async function deleteIssueCategory(companyId: string, issueCategoryId: string) {
  await ensureCategory(companyId, issueCategoryId);
  await db.delete(issueCategories).where(and(eq(issueCategories.id, issueCategoryId), eq(issueCategories.companyId, companyId)));
  return { id: issueCategoryId };
}
