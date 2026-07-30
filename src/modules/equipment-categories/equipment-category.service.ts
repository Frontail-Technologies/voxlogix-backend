import { and, asc, count, eq, ilike, type SQL } from "drizzle-orm";

import { db } from "@/db";
import { equipmentCategories } from "@/db/schema";
import { AppError } from "@/shared/errors/app-error";
import { ERROR_CODES } from "@/shared/errors/error-codes";
import { HTTP_STATUS } from "@/shared/errors/http-status";
import { buildPagination } from "@/shared/helpers/pagination";

type ListInput = { companyId: string; page: number; limit: number; search?: string; status?: string };
function whereFor(input: Omit<ListInput, "page" | "limit">) {
  const filters: SQL<unknown>[] = [eq(equipmentCategories.companyId, input.companyId)];
  if (input.search) filters.push(ilike(equipmentCategories.name, `%${input.search}%`));
  if (input.status) filters.push(eq(equipmentCategories.status, input.status));
  return and(...filters);
}
async function ensureCategory(companyId: string, equipmentCategoryId: string) {
  const [existing] = await db.select({ id: equipmentCategories.id }).from(equipmentCategories).where(and(eq(equipmentCategories.id, equipmentCategoryId), eq(equipmentCategories.companyId, companyId))).limit(1);
  if (!existing) throw new AppError({ message: "Equipment category not found.", statusCode: HTTP_STATUS.NOT_FOUND, errorCode: ERROR_CODES.NOT_FOUND });
}
export async function listEquipmentCategories(input: ListInput) {
  const where = whereFor(input);
  const [{ totalItems }] = await db.select({ totalItems: count() }).from(equipmentCategories).where(where);
  const pagination = buildPagination({ page: input.page, limit: input.limit, totalItems });
  const items = await db.select().from(equipmentCategories).where(where).orderBy(asc(equipmentCategories.name)).limit(pagination.limit).offset(pagination.offset);
  return { items, pagination };
}
export async function getEquipmentCategory(companyId: string, equipmentCategoryId: string) {
  const [item] = await db.select().from(equipmentCategories).where(and(eq(equipmentCategories.id, equipmentCategoryId), eq(equipmentCategories.companyId, companyId))).limit(1);
  if (!item) throw new AppError({ message: "Equipment category not found.", statusCode: HTTP_STATUS.NOT_FOUND, errorCode: ERROR_CODES.NOT_FOUND });
  return item;
}
export async function createEquipmentCategory(companyId: string, input: typeof equipmentCategories.$inferInsert) {
  const [created] = await db.insert(equipmentCategories).values({ ...input, companyId, updatedAt: new Date() }).returning({ id: equipmentCategories.id });
  return getEquipmentCategory(companyId, created.id);
}
export async function updateEquipmentCategory(companyId: string, equipmentCategoryId: string, input: Partial<typeof equipmentCategories.$inferInsert>) {
  await ensureCategory(companyId, equipmentCategoryId);
  await db.update(equipmentCategories).set({ ...input, updatedAt: new Date() }).where(and(eq(equipmentCategories.id, equipmentCategoryId), eq(equipmentCategories.companyId, companyId)));
  return getEquipmentCategory(companyId, equipmentCategoryId);
}
export async function deleteEquipmentCategory(companyId: string, equipmentCategoryId: string) {
  await ensureCategory(companyId, equipmentCategoryId);
  await db.delete(equipmentCategories).where(and(eq(equipmentCategories.id, equipmentCategoryId), eq(equipmentCategories.companyId, companyId)));
  return { id: equipmentCategoryId };
}
