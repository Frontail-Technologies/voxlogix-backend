import { and, asc, count, eq, ilike, or, type SQL } from "drizzle-orm";

import { db } from "@/db";
import { locations } from "@/db/schema";
import { AppError } from "@/shared/errors/app-error";
import { ERROR_CODES } from "@/shared/errors/error-codes";
import { HTTP_STATUS } from "@/shared/errors/http-status";
import { buildPagination } from "@/shared/helpers/pagination";

type ListLocationsInput = {
  companyId: string;
  page: number;
  limit: number;
  search?: string;
  status?: string;
};

function whereFor(input: Omit<ListLocationsInput, "page" | "limit">) {
  const filters: SQL<unknown>[] = [eq(locations.companyId, input.companyId)];
  if (input.search) {
    filters.push(or(ilike(locations.plant, `%${input.search}%`), ilike(locations.section, `%${input.search}%`), ilike(locations.subLocation, `%${input.search}%`), ilike(locations.shiftDetails, `%${input.search}%`), ilike(locations.department, `%${input.search}%`))!);
  }
  if (input.status) filters.push(eq(locations.status, input.status));
  return and(...filters);
}

async function ensureLocation(companyId: string, locationId: string) {
  const [existing] = await db.select({ id: locations.id }).from(locations).where(and(eq(locations.id, locationId), eq(locations.companyId, companyId))).limit(1);
  if (!existing) throw new AppError({ message: "Location not found.", statusCode: HTTP_STATUS.NOT_FOUND, errorCode: ERROR_CODES.NOT_FOUND });
}

export async function listLocations(input: ListLocationsInput) {
  const where = whereFor(input);
  const [{ totalItems }] = await db.select({ totalItems: count() }).from(locations).where(where);
  const pagination = buildPagination({ page: input.page, limit: input.limit, totalItems });
  const items = await db.select().from(locations).where(where).orderBy(asc(locations.section), asc(locations.subLocation)).limit(pagination.limit).offset(pagination.offset);
  return { items, pagination };
}

export async function createLocation(companyId: string, input: typeof locations.$inferInsert) {
  const [created] = await db.insert(locations).values({ ...input, companyId, updatedAt: new Date() }).returning({ id: locations.id });
  return getLocation(companyId, created.id);
}

export async function getLocation(companyId: string, locationId: string) {
  const [location] = await db.select().from(locations).where(and(eq(locations.id, locationId), eq(locations.companyId, companyId))).limit(1);
  if (!location) throw new AppError({ message: "Location not found.", statusCode: HTTP_STATUS.NOT_FOUND, errorCode: ERROR_CODES.NOT_FOUND });
  return location;
}

export async function updateLocation(companyId: string, locationId: string, input: Partial<typeof locations.$inferInsert>) {
  await ensureLocation(companyId, locationId);
  await db.update(locations).set({ ...input, updatedAt: new Date() }).where(and(eq(locations.id, locationId), eq(locations.companyId, companyId)));
  return getLocation(companyId, locationId);
}

export async function deleteLocation(companyId: string, locationId: string) {
  await ensureLocation(companyId, locationId);
  await db.delete(locations).where(and(eq(locations.id, locationId), eq(locations.companyId, companyId)));
  return { id: locationId };
}

