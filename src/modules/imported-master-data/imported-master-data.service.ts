import { and, asc, count, eq, ilike, or, type SQL } from "drizzle-orm";

import { db } from "@/db";
import { kaizenCategories, measuringPoints, meterCounters, safetyReportingMasters } from "@/db/schema";
import { buildPagination } from "@/shared/helpers/pagination";

type ListInput = { companyId: string; page: number; limit: number; search?: string; status?: string };

function baseFilters(companyId: string, status: string | undefined, companyColumn: Parameters<typeof eq>[0], statusColumn: Parameters<typeof eq>[0]) {
  const filters: SQL<unknown>[] = [eq(companyColumn, companyId)];
  if (status) filters.push(eq(statusColumn, status));
  return filters;
}

async function paginate<T>(input: ListInput, table: unknown, where: SQL<unknown> | undefined, order: SQL<unknown>[], selectRows: (limit: number, offset: number) => Promise<T[]>) {
  const [{ totalItems }] = await db.select({ totalItems: count() }).from(table as never).where(where);
  const pagination = buildPagination({ page: input.page, limit: input.limit, totalItems });
  const items = await selectRows(pagination.limit, pagination.offset);
  void order;
  return { items, pagination };
}

export async function listSafetyReporting(input: ListInput) {
  const filters = baseFilters(input.companyId, input.status, safetyReportingMasters.companyId, safetyReportingMasters.status);
  if (input.search) filters.push(or(ilike(safetyReportingMasters.incidentCategory, `%${input.search}%`), ilike(safetyReportingMasters.incidentType, `%${input.search}%`))!);
  const where = and(...filters);
  return paginate(input, safetyReportingMasters, where, [asc(safetyReportingMasters.incidentCategory)], (limit, offset) => db.select().from(safetyReportingMasters).where(where).orderBy(asc(safetyReportingMasters.incidentCategory), asc(safetyReportingMasters.incidentType)).limit(limit).offset(offset));
}

export async function listMeasuringPoints(input: ListInput) {
  const filters = baseFilters(input.companyId, input.status, measuringPoints.companyId, measuringPoints.status);
  if (input.search) filters.push(or(ilike(measuringPoints.pointCode, `%${input.search}%`), ilike(measuringPoints.measurementName, `%${input.search}%`), ilike(measuringPoints.equipmentCodeSnapshot, `%${input.search}%`))!);
  const where = and(...filters);
  return paginate(input, measuringPoints, where, [asc(measuringPoints.pointCode)], (limit, offset) => db.select().from(measuringPoints).where(where).orderBy(asc(measuringPoints.pointCode)).limit(limit).offset(offset));
}

export async function listMeterCounters(input: ListInput) {
  const filters = baseFilters(input.companyId, input.status, meterCounters.companyId, meterCounters.status);
  if (input.search) filters.push(or(ilike(meterCounters.counterCode, `%${input.search}%`), ilike(meterCounters.counterName, `%${input.search}%`), ilike(meterCounters.equipmentCodeSnapshot, `%${input.search}%`))!);
  const where = and(...filters);
  return paginate(input, meterCounters, where, [asc(meterCounters.counterCode)], (limit, offset) => db.select().from(meterCounters).where(where).orderBy(asc(meterCounters.counterCode)).limit(limit).offset(offset));
}

export async function listKaizenCategories(input: ListInput) {
  const filters = baseFilters(input.companyId, input.status, kaizenCategories.companyId, kaizenCategories.status);
  if (input.search) filters.push(or(ilike(kaizenCategories.category, `%${input.search}%`), ilike(kaizenCategories.department, `%${input.search}%`))!);
  const where = and(...filters);
  return paginate(input, kaizenCategories, where, [asc(kaizenCategories.category)], (limit, offset) => db.select().from(kaizenCategories).where(where).orderBy(asc(kaizenCategories.category)).limit(limit).offset(offset));
}
