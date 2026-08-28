import { and, asc, count, desc, eq, ilike, inArray, or, type SQL } from "drizzle-orm";
import type { PgColumn, PgTable } from "drizzle-orm/pg-core";

import { db } from "@/db";
import { kaizenCategories, measuringPointReadings, measuringPoints, meterCounterReadings, meterCounters, safetyReportingMasters } from "@/db/schema";
import { AppError } from "@/shared/errors/app-error";
import { ERROR_CODES } from "@/shared/errors/error-codes";
import { HTTP_STATUS } from "@/shared/errors/http-status";
import { buildPagination } from "@/shared/helpers/pagination";

/** Numeric columns are Postgres `numeric`, which drizzle expects as strings.
 * Converts a coerced-number-or-null-or-undefined form field into the string
 * (or null, to clear the field) drizzle needs, leaving untouched fields alone. */
function numericField(value: number | null | undefined): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  return String(value);
}

async function ensureRow(table: PgTable, idColumn: PgColumn, companyColumn: PgColumn, companyId: string, id: string, notFoundMessage: string) {
  const [existing] = await db.select({ id: idColumn }).from(table).where(and(eq(idColumn, id), eq(companyColumn, companyId))).limit(1);
  if (!existing) throw new AppError({ message: notFoundMessage, statusCode: HTTP_STATUS.NOT_FOUND, errorCode: ERROR_CODES.NOT_FOUND });
}

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

// One extra query per page (not per row) via DISTINCT ON — the latest
// reading per point/counter in the current page, keyed for an in-memory
// merge. Avoids N+1 while keeping the existing paginated list query
// untouched. Values stay as the numeric-as-string shape the rest of this
// codebase already uses for `numeric` columns.
async function latestMeasuringPointReadings(pointIds: string[]) {
  if (pointIds.length === 0) return new Map<string, { value: string; status: string; isAlert: boolean; reportedAt: Date }>();
  const rows = await db
    .selectDistinctOn([measuringPointReadings.pointId], {
      pointId: measuringPointReadings.pointId,
      value: measuringPointReadings.measuredValue,
      status: measuringPointReadings.measurementStatus,
      isAlert: measuringPointReadings.isAlert,
      reportedAt: measuringPointReadings.reportedAt,
    })
    .from(measuringPointReadings)
    .where(inArray(measuringPointReadings.pointId, pointIds))
    .orderBy(measuringPointReadings.pointId, desc(measuringPointReadings.reportedAt));
  return new Map(rows.map((row) => [row.pointId, { value: row.value, status: row.status, isAlert: row.isAlert, reportedAt: row.reportedAt }]));
}

async function latestMeterCounterReadings(counterIds: string[]) {
  if (counterIds.length === 0) return new Map<string, { value: string; status: string; isAlert: boolean; reportedAt: Date }>();
  const rows = await db
    .selectDistinctOn([meterCounterReadings.counterId], {
      counterId: meterCounterReadings.counterId,
      value: meterCounterReadings.currentReading,
      status: meterCounterReadings.counterStatus,
      isAlert: meterCounterReadings.isAlert,
      reportedAt: meterCounterReadings.reportedAt,
    })
    .from(meterCounterReadings)
    .where(inArray(meterCounterReadings.counterId, counterIds))
    .orderBy(meterCounterReadings.counterId, desc(meterCounterReadings.reportedAt));
  return new Map(rows.map((row) => [row.counterId, { value: row.value, status: row.status, isAlert: row.isAlert, reportedAt: row.reportedAt }]));
}

export async function listMeasuringPoints(input: ListInput) {
  const filters = baseFilters(input.companyId, input.status, measuringPoints.companyId, measuringPoints.status);
  if (input.search) filters.push(or(ilike(measuringPoints.pointCode, `%${input.search}%`), ilike(measuringPoints.measurementName, `%${input.search}%`), ilike(measuringPoints.equipmentCodeSnapshot, `%${input.search}%`))!);
  const where = and(...filters);
  const result = await paginate(input, measuringPoints, where, [asc(measuringPoints.pointCode)], (limit, offset) => db.select().from(measuringPoints).where(where).orderBy(asc(measuringPoints.pointCode)).limit(limit).offset(offset));
  const latest = await latestMeasuringPointReadings(result.items.map((item) => item.id));
  return { ...result, items: result.items.map((item) => ({ ...item, latestReading: latest.get(item.id) ?? null })) };
}

export async function listMeterCounters(input: ListInput) {
  const filters = baseFilters(input.companyId, input.status, meterCounters.companyId, meterCounters.status);
  if (input.search) filters.push(or(ilike(meterCounters.counterCode, `%${input.search}%`), ilike(meterCounters.counterName, `%${input.search}%`), ilike(meterCounters.equipmentCodeSnapshot, `%${input.search}%`))!);
  const where = and(...filters);
  const result = await paginate(input, meterCounters, where, [asc(meterCounters.counterCode)], (limit, offset) => db.select().from(meterCounters).where(where).orderBy(asc(meterCounters.counterCode)).limit(limit).offset(offset));
  const latest = await latestMeterCounterReadings(result.items.map((item) => item.id));
  return { ...result, items: result.items.map((item) => ({ ...item, latestReading: latest.get(item.id) ?? null })) };
}

export async function listKaizenCategories(input: ListInput) {
  const filters = baseFilters(input.companyId, input.status, kaizenCategories.companyId, kaizenCategories.status);
  if (input.search) filters.push(or(ilike(kaizenCategories.category, `%${input.search}%`), ilike(kaizenCategories.department, `%${input.search}%`))!);
  const where = and(...filters);
  return paginate(input, kaizenCategories, where, [asc(kaizenCategories.category)], (limit, offset) => db.select().from(kaizenCategories).where(where).orderBy(asc(kaizenCategories.category)).limit(limit).offset(offset));
}

// --- Safety reporting: update / delete ---
export async function updateSafetyReporting(companyId: string, id: string, input: Partial<typeof safetyReportingMasters.$inferInsert>) {
  await ensureRow(safetyReportingMasters, safetyReportingMasters.id, safetyReportingMasters.companyId, companyId, id, "Safety reporting record not found.");
  await db.update(safetyReportingMasters).set({ ...input, updatedAt: new Date() }).where(and(eq(safetyReportingMasters.id, id), eq(safetyReportingMasters.companyId, companyId)));
  const [item] = await db.select().from(safetyReportingMasters).where(eq(safetyReportingMasters.id, id)).limit(1);
  return item;
}
export async function deleteSafetyReporting(companyId: string, id: string) {
  await ensureRow(safetyReportingMasters, safetyReportingMasters.id, safetyReportingMasters.companyId, companyId, id, "Safety reporting record not found.");
  // Soft delete (status -> INACTIVE) rather than a hard delete, matching the
  // existing Active/Inactive status filter already in the admin UI.
  await db.update(safetyReportingMasters).set({ status: "INACTIVE", updatedAt: new Date() }).where(and(eq(safetyReportingMasters.id, id), eq(safetyReportingMasters.companyId, companyId)));
  return { id };
}

// --- Measuring points: update / delete ---
export async function updateMeasuringPoint(companyId: string, id: string, input: { targetValue?: number | null; lowerLimit?: number | null; upperLimit?: number | null } & Partial<typeof measuringPoints.$inferInsert>) {
  await ensureRow(measuringPoints, measuringPoints.id, measuringPoints.companyId, companyId, id, "Measuring point not found.");
  const { targetValue, lowerLimit, upperLimit, ...rest } = input;
  await db
    .update(measuringPoints)
    .set({ ...rest, targetValue: numericField(targetValue), lowerLimit: numericField(lowerLimit), upperLimit: numericField(upperLimit), updatedAt: new Date() })
    .where(and(eq(measuringPoints.id, id), eq(measuringPoints.companyId, companyId)));
  const [item] = await db.select().from(measuringPoints).where(eq(measuringPoints.id, id)).limit(1);
  return item;
}
export async function deleteMeasuringPoint(companyId: string, id: string) {
  await ensureRow(measuringPoints, measuringPoints.id, measuringPoints.companyId, companyId, id, "Measuring point not found.");
  // Soft delete: measuring_point_readings cascade-deletes on a hard delete of
  // its point, which would silently wipe logged reading history. Deactivating
  // instead keeps history intact and matches the existing status filter.
  await db.update(measuringPoints).set({ status: "INACTIVE", updatedAt: new Date() }).where(and(eq(measuringPoints.id, id), eq(measuringPoints.companyId, companyId)));
  return { id };
}

// --- Meter counters: update / delete ---
export async function updateMeterCounter(
  companyId: string,
  id: string,
  input: { initialReading?: number | null; resetValue?: number | null; expectedDailyConsumption?: number | null; alertDeviationPct?: number | null } & Partial<typeof meterCounters.$inferInsert>,
) {
  await ensureRow(meterCounters, meterCounters.id, meterCounters.companyId, companyId, id, "Meter counter not found.");
  const { initialReading, resetValue, expectedDailyConsumption, alertDeviationPct, ...rest } = input;
  await db
    .update(meterCounters)
    .set({
      ...rest,
      initialReading: numericField(initialReading),
      resetValue: numericField(resetValue),
      expectedDailyConsumption: numericField(expectedDailyConsumption),
      alertDeviationPct: numericField(alertDeviationPct),
      updatedAt: new Date(),
    })
    .where(and(eq(meterCounters.id, id), eq(meterCounters.companyId, companyId)));
  const [item] = await db.select().from(meterCounters).where(eq(meterCounters.id, id)).limit(1);
  return item;
}
export async function deleteMeterCounter(companyId: string, id: string) {
  await ensureRow(meterCounters, meterCounters.id, meterCounters.companyId, companyId, id, "Meter counter not found.");
  // Soft delete: meter_counter_readings cascade-deletes on a hard delete of
  // its counter, which would silently wipe logged reading history. Deactivating
  // instead keeps history intact and matches the existing status filter.
  await db.update(meterCounters).set({ status: "INACTIVE", updatedAt: new Date() }).where(and(eq(meterCounters.id, id), eq(meterCounters.companyId, companyId)));
  return { id };
}

// --- Kaizen categories: update / delete ---
export async function updateKaizenCategory(companyId: string, id: string, input: Partial<typeof kaizenCategories.$inferInsert>) {
  await ensureRow(kaizenCategories, kaizenCategories.id, kaizenCategories.companyId, companyId, id, "Kaizen category not found.");
  await db.update(kaizenCategories).set({ ...input, updatedAt: new Date() }).where(and(eq(kaizenCategories.id, id), eq(kaizenCategories.companyId, companyId)));
  const [item] = await db.select().from(kaizenCategories).where(eq(kaizenCategories.id, id)).limit(1);
  return item;
}
export async function deleteKaizenCategory(companyId: string, id: string) {
  await ensureRow(kaizenCategories, kaizenCategories.id, kaizenCategories.companyId, companyId, id, "Kaizen category not found.");
  await db.update(kaizenCategories).set({ status: "INACTIVE", updatedAt: new Date() }).where(and(eq(kaizenCategories.id, id), eq(kaizenCategories.companyId, companyId)));
  return { id };
}
