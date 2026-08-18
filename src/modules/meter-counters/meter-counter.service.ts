import { and, asc, count, desc, eq, ilike, or, sql, type SQL } from "drizzle-orm";

import { db } from "@/db";
import {
  admins,
  equipmentAssets,
  logTimelineEvents,
  meterCounterReadings,
  meterCounters,
  modules,
  moduleTypes,
  operationalLogs,
} from "@/db/schema";
import type {
  MeterCounterLookupInput,
  MeterCounterReadingInput,
} from "@/modules/meter-counters/meter-counter.types";
import {
  dbNumber,
  evaluateCounterReading,
  nullableNumber,
  parseFiniteNumber,
} from "@/shared/domain/reading-calculations";
import { AppError } from "@/shared/errors/app-error";
import { ERROR_CODES } from "@/shared/errors/error-codes";
import { HTTP_STATUS } from "@/shared/errors/http-status";
import { buildPagination } from "@/shared/helpers/pagination";

type DbExecutor = Pick<typeof db, "select" | "insert" | "update" | "execute">;

function makeLogNumber() {
  return `LOG-${Date.now().toString().slice(-8)}`;
}

function makeReadingReportLogId() {
  return `CT-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
}

function toNumberPayload(value: string | number | null | undefined) {
  return nullableNumber(value);
}

async function getCounterModule(tx: DbExecutor) {
  const [module] = await tx
    .select({ id: modules.id, name: modules.name, type: moduleTypes.name })
    .from(modules)
    .leftJoin(moduleTypes, eq(modules.moduleTypeId, moduleTypes.id))
    .where(
      and(
        eq(modules.status, "ACTIVE"),
        sql<boolean>`(
          lower(${modules.name}) like '%meter%'
          or lower(${modules.name}) like '%counter%'
          or lower(${moduleTypes.name}) like '%meter%'
          or lower(${moduleTypes.name}) like '%counter%'
          or lower(${modules.slug}) like '%meter%'
          or lower(${modules.slug}) like '%counter%'
        )`,
      ),
    )
    .limit(1);

  return module ?? { id: null, name: "Meter Counter", type: "Meter Counter" };
}

async function createCounterAlertLog(
  tx: DbExecutor,
  input: {
    companyId: string;
    moduleId: string | null;
    moduleType: string;
    equipmentId: string | null;
    reportedById?: string;
    reportedByName?: string;
    title: string;
    extractedFields: Record<string, unknown>;
  },
) {
  const [created] = await tx
    .insert(operationalLogs)
    .values({
      companyId: input.companyId,
      moduleId: input.moduleId,
      equipmentId: input.equipmentId,
      createdById: input.reportedById ?? null,
      logNumber: makeLogNumber(),
      moduleType: input.moduleType,
      title: input.title,
      description: input.title,
      transcript: null,
      issueCategory: "Meter Counter Alert",
      severity: "HIGH",
      status: "HIGH_DEVIATION",
      aiProcessed: 0,
      voiceDurationSeconds: 0,
      downtimeMinutes: 0,
      extractedFields: input.extractedFields,
      updatedAt: new Date(),
    })
    .returning({ id: operationalLogs.id });

  await tx.insert(logTimelineEvents).values({
    logId: created.id,
    actorId: input.reportedById ?? null,
    actorNameSnapshot: input.reportedByName ?? "System",
    event: "Meter counter alert created",
    status: "HIGH_DEVIATION",
  });

  return created.id;
}

function mapCounter(row: {
  id: string;
  counterCode: string;
  equipmentId: string | null;
  equipmentCodeSnapshot: string | null;
  location: string | null;
  counterName: string;
  counterUnit: string;
  meterType: string;
  readingFrequency: string | null;
  initialReading: string | null;
  resetValue: string | null;
  expectedDailyConsumption: string | null;
  alertDeviationPct: string | null;
  status: string;
  previousReading: string | null;
  previousReadingAt: Date | null;
  equipment: { id: string; equipmentCode: string; name: string; section: string; subLocation: string } | null;
}) {
  return {
    id: row.id,
    counterCode: row.counterCode,
    equipmentId: row.equipmentId,
    equipmentCode: row.equipment?.equipmentCode ?? row.equipmentCodeSnapshot,
    equipmentName: row.equipment?.name ?? null,
    equipmentSection: row.equipment?.section ?? null,
    equipmentSubLocation: row.equipment?.subLocation ?? null,
    location: row.location,
    counterName: row.counterName,
    counterUnit: row.counterUnit,
    meterType: row.meterType,
    readingFrequency: row.readingFrequency,
    initialReading: toNumberPayload(row.initialReading),
    resetValue: toNumberPayload(row.resetValue),
    expectedDailyConsumption: toNumberPayload(row.expectedDailyConsumption),
    alertDeviationPct: toNumberPayload(row.alertDeviationPct),
    previousReading: row.previousReading ? toNumberPayload(row.previousReading) : toNumberPayload(row.initialReading),
    previousReadingAt: row.previousReadingAt,
    status: row.status,
  };
}

export async function listMeterCounterLookup(input: MeterCounterLookupInput) {
  const filters: SQL<unknown>[] = [
    eq(meterCounters.companyId, input.companyId),
    eq(meterCounters.status, "ACTIVE"),
  ];

  if (input.counterCode) {
    filters.push(sql<boolean>`lower(${meterCounters.counterCode}) = lower(${input.counterCode})`);
  } else if (input.search) {
    filters.push(
      or(
        ilike(meterCounters.counterCode, `%${input.search}%`),
        ilike(meterCounters.counterName, `%${input.search}%`),
        ilike(meterCounters.equipmentCodeSnapshot, `%${input.search}%`),
        ilike(equipmentAssets.name, `%${input.search}%`),
      )!,
    );
  }

  const previousReadingSql = sql<string | null>`(
    SELECT ${meterCounterReadings.currentReading}
    FROM ${meterCounterReadings}
    WHERE ${meterCounterReadings.counterId} = ${meterCounters.id}
    ORDER BY ${meterCounterReadings.reportedAt} DESC
    LIMIT 1
  )`;
  const previousReadingAtSql = sql<Date | null>`(
    SELECT ${meterCounterReadings.reportedAt}
    FROM ${meterCounterReadings}
    WHERE ${meterCounterReadings.counterId} = ${meterCounters.id}
    ORDER BY ${meterCounterReadings.reportedAt} DESC
    LIMIT 1
  )`;
  const where = and(...filters);
  const [{ totalItems }] = await db
    .select({ totalItems: count() })
    .from(meterCounters)
    .leftJoin(equipmentAssets, eq(meterCounters.equipmentId, equipmentAssets.id))
    .where(where);
  const pagination = buildPagination({ page: input.page, limit: input.limit, totalItems });

  const rows = await db
    .select({
      id: meterCounters.id,
      counterCode: meterCounters.counterCode,
      equipmentId: meterCounters.equipmentId,
      equipmentCodeSnapshot: meterCounters.equipmentCodeSnapshot,
      location: meterCounters.location,
      counterName: meterCounters.counterName,
      counterUnit: meterCounters.counterUnit,
      meterType: meterCounters.meterType,
      readingFrequency: meterCounters.readingFrequency,
      initialReading: meterCounters.initialReading,
      resetValue: meterCounters.resetValue,
      expectedDailyConsumption: meterCounters.expectedDailyConsumption,
      alertDeviationPct: meterCounters.alertDeviationPct,
      status: meterCounters.status,
      previousReading: previousReadingSql,
      previousReadingAt: previousReadingAtSql,
      equipment: {
        id: equipmentAssets.id,
        equipmentCode: equipmentAssets.equipmentCode,
        name: equipmentAssets.name,
        section: equipmentAssets.section,
        subLocation: equipmentAssets.subLocation,
      },
    })
    .from(meterCounters)
    .leftJoin(equipmentAssets, eq(meterCounters.equipmentId, equipmentAssets.id))
    .where(where)
    .orderBy(asc(meterCounters.counterCode))
    .limit(pagination.limit)
    .offset(pagination.offset);

  return { items: rows.map(mapCounter), pagination };
}

export async function createMeterCounterReading(input: MeterCounterReadingInput) {
  const currentReading = parseFiniteNumber(input.currentReading, "Current reading");

  return db.transaction(async (tx) => {
    await tx.execute(sql`
      SELECT id
      FROM ${meterCounters}
      WHERE ${meterCounters.id} = ${input.counterId}
        AND ${meterCounters.companyId} = ${input.companyId}
      FOR UPDATE
    `);

    const [counter] = await tx
      .select({
        id: meterCounters.id,
        companyId: meterCounters.companyId,
        equipmentId: meterCounters.equipmentId,
        counterCode: meterCounters.counterCode,
        equipmentCodeSnapshot: meterCounters.equipmentCodeSnapshot,
        location: meterCounters.location,
        counterName: meterCounters.counterName,
        counterUnit: meterCounters.counterUnit,
        meterType: meterCounters.meterType,
        initialReading: meterCounters.initialReading,
        resetValue: meterCounters.resetValue,
        expectedDailyConsumption: meterCounters.expectedDailyConsumption,
        alertDeviationPct: meterCounters.alertDeviationPct,
        status: meterCounters.status,
        equipment: {
          equipmentCode: equipmentAssets.equipmentCode,
        },
      })
      .from(meterCounters)
      .leftJoin(equipmentAssets, eq(meterCounters.equipmentId, equipmentAssets.id))
      .where(and(eq(meterCounters.id, input.counterId), eq(meterCounters.companyId, input.companyId)))
      .limit(1);

    if (!counter || counter.status !== "ACTIVE") {
      throw new AppError({
        message: "Meter counter not available.",
        statusCode: HTTP_STATUS.NOT_FOUND,
        errorCode: ERROR_CODES.NOT_FOUND,
      });
    }

    const [previous] = await tx
      .select({
        currentReading: meterCounterReadings.currentReading,
        reportedAt: meterCounterReadings.reportedAt,
      })
      .from(meterCounterReadings)
      .where(and(eq(meterCounterReadings.companyId, input.companyId), eq(meterCounterReadings.counterId, counter.id)))
      .orderBy(desc(meterCounterReadings.reportedAt))
      .limit(1);

    const initialReading = nullableNumber(counter.initialReading);
    const previousReading = previous ? nullableNumber(previous.currentReading) : initialReading;
    const previousReadingAt = previous?.reportedAt ?? null;
    const resetValue = nullableNumber(counter.resetValue);
    const expectedDailyConsumption = nullableNumber(counter.expectedDailyConsumption);
    const alertDeviationPct = nullableNumber(counter.alertDeviationPct);
    const reportedAt = new Date();

    let result;
    try {
      result = evaluateCounterReading({
        currentReading,
        previousReading,
        previousReadingAt,
        currentReadingAt: reportedAt,
        resetValue,
        expectedDailyConsumption,
        alertDeviationPct,
      });
    } catch (error) {
      throw new AppError({
        message: error instanceof Error ? error.message : "Invalid meter reading.",
        statusCode: HTTP_STATUS.BAD_REQUEST,
        errorCode: ERROR_CODES.VALIDATION_ERROR,
      });
    }

    const module = await getCounterModule(tx);
    let operationalLogId: string | null = null;

    if (result.isAlert) {
      operationalLogId = await createCounterAlertLog(tx, {
        companyId: input.companyId,
        moduleId: module.id,
        moduleType: module.name || module.type || "Meter Counter",
        equipmentId: counter.equipmentId,
        reportedById: input.reportedById,
        reportedByName: input.reportedByName,
        title: `${counter.counterCode} - ${counter.counterName} high deviation`,
        extractedFields: {
          readingType: "METER_COUNTER",
          isAlert: true,
          readingStatus: result.counterStatus,
          counterStatus: result.counterStatus,
          readingId: null,
          counterId: counter.id,
          counterCode: counter.counterCode,
          counterName: counter.counterName,
          unit: counter.counterUnit,
          currentReading,
          previousReading,
          previousReadingAt,
          consumptionDelta: result.consumptionDelta,
          expectedConsumptionForPeriod: result.expectedConsumptionForPeriod,
          deviation: result.deviation,
          deviationPercent: result.deviationPercent,
          alertDeviationPct,
        },
      });
    }

    const [reading] = await tx
      .insert(meterCounterReadings)
      .values({
        companyId: input.companyId,
        counterId: counter.id,
        equipmentId: counter.equipmentId,
        operationalLogId,
        reportLogId: makeReadingReportLogId(),
        counterCode: counter.counterCode,
        equipmentCodeSnapshot: counter.equipment?.equipmentCode ?? counter.equipmentCodeSnapshot,
        locationSnapshot: counter.location,
        counterNameSnapshot: counter.counterName,
        counterUnitSnapshot: counter.counterUnit,
        meterTypeSnapshot: counter.meterType,
        currentReading: dbNumber(currentReading)!,
        previousReading: dbNumber(previousReading),
        consumptionDelta: dbNumber(result.consumptionDelta),
        previousReadingAt,
        expectedDailyConsumptionSnapshot: dbNumber(expectedDailyConsumption),
        expectedConsumptionForPeriod: dbNumber(result.expectedConsumptionForPeriod),
        deviation: dbNumber(result.deviation),
        deviationPercent: dbNumber(result.deviationPercent),
        alertDeviationPctSnapshot: alertDeviationPct === null ? null : alertDeviationPct.toFixed(2),
        resetValueSnapshot: dbNumber(resetValue),
        counterStatus: result.counterStatus,
        isAlert: result.isAlert,
        reportedById: input.reportedById ?? null,
        reportedAt,
      })
      .returning();

    if (operationalLogId) {
      await tx
        .update(operationalLogs)
        .set({
          extractedFields: {
            readingType: "METER_COUNTER",
            isAlert: true,
            readingStatus: result.counterStatus,
            counterStatus: result.counterStatus,
            readingId: reading.id,
            counterId: counter.id,
            counterCode: counter.counterCode,
            counterName: counter.counterName,
            unit: counter.counterUnit,
            currentReading,
            previousReading,
            previousReadingAt,
            consumptionDelta: result.consumptionDelta,
            expectedConsumptionForPeriod: result.expectedConsumptionForPeriod,
            deviation: result.deviation,
            deviationPercent: result.deviationPercent,
            alertDeviationPct,
          },
        })
        .where(eq(operationalLogs.id, operationalLogId));
    }

    return {
      ...reading,
      currentReading: toNumberPayload(reading.currentReading),
      previousReading: toNumberPayload(reading.previousReading),
      consumptionDelta: toNumberPayload(reading.consumptionDelta),
      expectedDailyConsumptionSnapshot: toNumberPayload(reading.expectedDailyConsumptionSnapshot),
      expectedConsumptionForPeriod: toNumberPayload(reading.expectedConsumptionForPeriod),
      deviation: toNumberPayload(reading.deviation),
      deviationPercent: toNumberPayload(reading.deviationPercent),
      alertDeviationPctSnapshot: toNumberPayload(reading.alertDeviationPctSnapshot),
      resetValueSnapshot: toNumberPayload(reading.resetValueSnapshot),
    };
  });
}

export async function listMeterCounterReadings(companyId: string, counterId: string, page = 1, limit = 20) {
  const [{ totalItems }] = await db
    .select({ totalItems: count() })
    .from(meterCounterReadings)
    .where(and(eq(meterCounterReadings.companyId, companyId), eq(meterCounterReadings.counterId, counterId)));
  const pagination = buildPagination({ page, limit, totalItems });

  const rows = await db
    .select({
      id: meterCounterReadings.id,
      reportLogId: meterCounterReadings.reportLogId,
      counterCode: meterCounterReadings.counterCode,
      counterName: meterCounterReadings.counterNameSnapshot,
      counterUnit: meterCounterReadings.counterUnitSnapshot,
      currentReading: meterCounterReadings.currentReading,
      previousReading: meterCounterReadings.previousReading,
      consumptionDelta: meterCounterReadings.consumptionDelta,
      expectedConsumptionForPeriod: meterCounterReadings.expectedConsumptionForPeriod,
      deviation: meterCounterReadings.deviation,
      deviationPercent: meterCounterReadings.deviationPercent,
      alertDeviationPct: meterCounterReadings.alertDeviationPctSnapshot,
      counterStatus: meterCounterReadings.counterStatus,
      isAlert: meterCounterReadings.isAlert,
      reportedAt: meterCounterReadings.reportedAt,
      reportedBy: { id: admins.id, fullName: admins.fullName },
    })
    .from(meterCounterReadings)
    .leftJoin(admins, eq(meterCounterReadings.reportedById, admins.id))
    .where(and(eq(meterCounterReadings.companyId, companyId), eq(meterCounterReadings.counterId, counterId)))
    .orderBy(desc(meterCounterReadings.reportedAt))
    .limit(pagination.limit)
    .offset(pagination.offset);

  return {
    items: rows.map((row) => ({
      ...row,
      currentReading: toNumberPayload(row.currentReading),
      previousReading: toNumberPayload(row.previousReading),
      consumptionDelta: toNumberPayload(row.consumptionDelta),
      expectedConsumptionForPeriod: toNumberPayload(row.expectedConsumptionForPeriod),
      deviation: toNumberPayload(row.deviation),
      deviationPercent: toNumberPayload(row.deviationPercent),
      alertDeviationPct: toNumberPayload(row.alertDeviationPct),
    })),
    pagination,
  };
}
