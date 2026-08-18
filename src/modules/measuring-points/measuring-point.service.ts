import { and, asc, count, desc, eq, ilike, or, sql, type SQL } from "drizzle-orm";

import { db } from "@/db";
import {
  admins,
  equipmentAssets,
  logTimelineEvents,
  measuringPointReadings,
  measuringPoints,
  modules,
  moduleTypes,
  operationalLogs,
} from "@/db/schema";
import type {
  MeasuringPointLookupInput,
  MeasuringPointReadingInput,
} from "@/modules/measuring-points/measuring-point.types";
import {
  dbNumber,
  evaluateMeasurement,
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
  return `MP-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
}

function toNumberPayload(value: string | number | null | undefined) {
  return nullableNumber(value);
}

function mapPoint(row: {
  id: string;
  pointCode: string;
  equipmentId: string | null;
  equipmentCodeSnapshot: string | null;
  equipmentNameSnapshot: string | null;
  measurementName: string;
  measurementUnit: string;
  targetValue: string | null;
  lowerLimit: string | null;
  upperLimit: string | null;
  measurementFrequency: string | null;
  alertSeverity: string;
  status: string;
  equipment: { id: string; equipmentCode: string; name: string; section: string; subLocation: string } | null;
}) {
  return {
    id: row.id,
    pointCode: row.pointCode,
    equipmentId: row.equipmentId,
    equipmentCode: row.equipment?.equipmentCode ?? row.equipmentCodeSnapshot,
    equipmentName: row.equipment?.name ?? row.equipmentNameSnapshot,
    equipmentSection: row.equipment?.section ?? null,
    equipmentSubLocation: row.equipment?.subLocation ?? null,
    measurementName: row.measurementName,
    measurementUnit: row.measurementUnit,
    targetValue: toNumberPayload(row.targetValue),
    lowerLimit: toNumberPayload(row.lowerLimit),
    upperLimit: toNumberPayload(row.upperLimit),
    measurementFrequency: row.measurementFrequency,
    alertSeverity: row.alertSeverity,
    status: row.status,
  };
}

async function getMeasurementModule(tx: DbExecutor) {
  const [module] = await tx
    .select({ id: modules.id, name: modules.name, type: moduleTypes.name })
    .from(modules)
    .leftJoin(moduleTypes, eq(modules.moduleTypeId, moduleTypes.id))
    .where(
      and(
        eq(modules.status, "ACTIVE"),
        sql<boolean>`(
          lower(${modules.name}) like '%measur%'
          or lower(${moduleTypes.name}) like '%measur%'
          or lower(${modules.slug}) like '%measur%'
        )`,
      ),
    )
    .limit(1);

  return module ?? { id: null, name: "Measurement Point", type: "Measurement Point" };
}

async function createMeasurementAlertLog(
  tx: DbExecutor,
  input: {
    companyId: string;
    moduleId: string | null;
    moduleType: string;
    equipmentId: string | null;
    reportedById?: string;
    reportedByName?: string;
    title: string;
    severity: string;
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
      issueCategory: "Measurement Alert",
      severity: input.severity,
      status: "OUT_OF_LIMIT",
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
    event: "Measurement alert created",
    status: "OUT_OF_LIMIT",
  });

  return created.id;
}

export async function listMeasuringPointLookup(input: MeasuringPointLookupInput) {
  const filters: SQL<unknown>[] = [
    eq(measuringPoints.companyId, input.companyId),
    eq(measuringPoints.status, "ACTIVE"),
  ];

  if (input.pointCode) {
    filters.push(sql<boolean>`lower(${measuringPoints.pointCode}) = lower(${input.pointCode})`);
  } else if (input.search) {
    filters.push(
      or(
        ilike(measuringPoints.pointCode, `%${input.search}%`),
        ilike(measuringPoints.measurementName, `%${input.search}%`),
        ilike(measuringPoints.equipmentCodeSnapshot, `%${input.search}%`),
        ilike(equipmentAssets.name, `%${input.search}%`),
      )!,
    );
  }

  const where = and(...filters);
  const [{ totalItems }] = await db
    .select({ totalItems: count() })
    .from(measuringPoints)
    .leftJoin(equipmentAssets, eq(measuringPoints.equipmentId, equipmentAssets.id))
    .where(where);
  const pagination = buildPagination({ page: input.page, limit: input.limit, totalItems });

  const rows = await db
    .select({
      id: measuringPoints.id,
      pointCode: measuringPoints.pointCode,
      equipmentId: measuringPoints.equipmentId,
      equipmentCodeSnapshot: measuringPoints.equipmentCodeSnapshot,
      equipmentNameSnapshot: measuringPoints.equipmentNameSnapshot,
      measurementName: measuringPoints.measurementName,
      measurementUnit: measuringPoints.measurementUnit,
      targetValue: measuringPoints.targetValue,
      lowerLimit: measuringPoints.lowerLimit,
      upperLimit: measuringPoints.upperLimit,
      measurementFrequency: measuringPoints.measurementFrequency,
      alertSeverity: measuringPoints.alertSeverity,
      status: measuringPoints.status,
      equipment: {
        id: equipmentAssets.id,
        equipmentCode: equipmentAssets.equipmentCode,
        name: equipmentAssets.name,
        section: equipmentAssets.section,
        subLocation: equipmentAssets.subLocation,
      },
    })
    .from(measuringPoints)
    .leftJoin(equipmentAssets, eq(measuringPoints.equipmentId, equipmentAssets.id))
    .where(where)
    .orderBy(asc(measuringPoints.pointCode))
    .limit(pagination.limit)
    .offset(pagination.offset);

  return { items: rows.map(mapPoint), pagination };
}

export async function createMeasuringPointReading(input: MeasuringPointReadingInput) {
  const measuredValue = parseFiniteNumber(input.measuredValue, "Measured value");

  return db.transaction(async (tx) => {
    const [point] = await tx
      .select({
        id: measuringPoints.id,
        companyId: measuringPoints.companyId,
        equipmentId: measuringPoints.equipmentId,
        pointCode: measuringPoints.pointCode,
        equipmentCodeSnapshot: measuringPoints.equipmentCodeSnapshot,
        equipmentNameSnapshot: measuringPoints.equipmentNameSnapshot,
        measurementName: measuringPoints.measurementName,
        measurementUnit: measuringPoints.measurementUnit,
        targetValue: measuringPoints.targetValue,
        lowerLimit: measuringPoints.lowerLimit,
        upperLimit: measuringPoints.upperLimit,
        alertSeverity: measuringPoints.alertSeverity,
        status: measuringPoints.status,
        equipment: {
          equipmentCode: equipmentAssets.equipmentCode,
          name: equipmentAssets.name,
        },
      })
      .from(measuringPoints)
      .leftJoin(equipmentAssets, eq(measuringPoints.equipmentId, equipmentAssets.id))
      .where(and(eq(measuringPoints.id, input.pointId), eq(measuringPoints.companyId, input.companyId)))
      .limit(1);

    if (!point || point.status !== "ACTIVE") {
      throw new AppError({
        message: "Measuring point not available.",
        statusCode: HTTP_STATUS.NOT_FOUND,
        errorCode: ERROR_CODES.NOT_FOUND,
      });
    }

    const targetValue = nullableNumber(point.targetValue);
    const lowerLimit = nullableNumber(point.lowerLimit);
    const upperLimit = nullableNumber(point.upperLimit);
    const result = evaluateMeasurement({ measuredValue, targetValue, lowerLimit, upperLimit });
    const reportedAt = new Date();
    const module = await getMeasurementModule(tx);
    let operationalLogId: string | null = null;

    if (result.isAlert) {
      operationalLogId = await createMeasurementAlertLog(tx, {
        companyId: input.companyId,
        moduleId: module.id,
        moduleType: module.name || module.type || "Measurement Point",
        equipmentId: point.equipmentId,
        reportedById: input.reportedById,
        reportedByName: input.reportedByName,
        title: `${point.pointCode} - ${point.measurementName} out of limit`,
        severity: point.alertSeverity,
        extractedFields: {
          readingType: "MEASURING_POINT",
          isAlert: true,
          readingStatus: result.measurementStatus,
          measurementStatus: result.measurementStatus,
          readingId: null,
          pointId: point.id,
          pointCode: point.pointCode,
          measurementName: point.measurementName,
          unit: point.measurementUnit,
          measuredValue,
          targetValue,
          lowerLimit,
          upperLimit,
          deviationFromTarget: result.deviationFromTarget,
          deviationPercent: result.deviationPercent,
        },
      });
    }

    const [reading] = await tx
      .insert(measuringPointReadings)
      .values({
        companyId: input.companyId,
        pointId: point.id,
        equipmentId: point.equipmentId,
        operationalLogId,
        reportLogId: makeReadingReportLogId(),
        pointCode: point.pointCode,
        equipmentCodeSnapshot: point.equipment?.equipmentCode ?? point.equipmentCodeSnapshot,
        equipmentNameSnapshot: point.equipment?.name ?? point.equipmentNameSnapshot,
        measurementNameSnapshot: point.measurementName,
        measurementUnitSnapshot: point.measurementUnit,
        measuredValue: dbNumber(measuredValue)!,
        targetValueSnapshot: dbNumber(targetValue),
        lowerLimitSnapshot: dbNumber(lowerLimit),
        upperLimitSnapshot: dbNumber(upperLimit),
        deviationFromTarget: dbNumber(result.deviationFromTarget),
        deviationPercent: dbNumber(result.deviationPercent),
        measurementStatus: result.measurementStatus,
        alertSeveritySnapshot: point.alertSeverity,
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
            readingType: "MEASURING_POINT",
            isAlert: true,
            readingStatus: result.measurementStatus,
            measurementStatus: result.measurementStatus,
            readingId: reading.id,
            pointId: point.id,
            pointCode: point.pointCode,
            measurementName: point.measurementName,
            unit: point.measurementUnit,
            measuredValue,
            targetValue,
            lowerLimit,
            upperLimit,
            deviationFromTarget: result.deviationFromTarget,
            deviationPercent: result.deviationPercent,
          },
        })
        .where(eq(operationalLogs.id, operationalLogId));
    }

    return {
      ...reading,
      measuredValue: toNumberPayload(reading.measuredValue),
      targetValueSnapshot: toNumberPayload(reading.targetValueSnapshot),
      lowerLimitSnapshot: toNumberPayload(reading.lowerLimitSnapshot),
      upperLimitSnapshot: toNumberPayload(reading.upperLimitSnapshot),
      deviationFromTarget: toNumberPayload(reading.deviationFromTarget),
      deviationPercent: toNumberPayload(reading.deviationPercent),
    };
  });
}

export async function listMeasuringPointReadings(companyId: string, pointId: string, page = 1, limit = 20) {
  const [{ totalItems }] = await db
    .select({ totalItems: count() })
    .from(measuringPointReadings)
    .where(and(eq(measuringPointReadings.companyId, companyId), eq(measuringPointReadings.pointId, pointId)));
  const pagination = buildPagination({ page, limit, totalItems });

  const rows = await db
    .select({
      id: measuringPointReadings.id,
      reportLogId: measuringPointReadings.reportLogId,
      pointCode: measuringPointReadings.pointCode,
      measurementName: measuringPointReadings.measurementNameSnapshot,
      measurementUnit: measuringPointReadings.measurementUnitSnapshot,
      measuredValue: measuringPointReadings.measuredValue,
      targetValue: measuringPointReadings.targetValueSnapshot,
      lowerLimit: measuringPointReadings.lowerLimitSnapshot,
      upperLimit: measuringPointReadings.upperLimitSnapshot,
      deviationFromTarget: measuringPointReadings.deviationFromTarget,
      deviationPercent: measuringPointReadings.deviationPercent,
      measurementStatus: measuringPointReadings.measurementStatus,
      isAlert: measuringPointReadings.isAlert,
      reportedAt: measuringPointReadings.reportedAt,
      reportedBy: { id: admins.id, fullName: admins.fullName },
    })
    .from(measuringPointReadings)
    .leftJoin(admins, eq(measuringPointReadings.reportedById, admins.id))
    .where(and(eq(measuringPointReadings.companyId, companyId), eq(measuringPointReadings.pointId, pointId)))
    .orderBy(desc(measuringPointReadings.reportedAt))
    .limit(pagination.limit)
    .offset(pagination.offset);

  return {
    items: rows.map((row) => ({
      ...row,
      measuredValue: toNumberPayload(row.measuredValue),
      targetValue: toNumberPayload(row.targetValue),
      lowerLimit: toNumberPayload(row.lowerLimit),
      upperLimit: toNumberPayload(row.upperLimit),
      deviationFromTarget: toNumberPayload(row.deviationFromTarget),
      deviationPercent: toNumberPayload(row.deviationPercent),
    })),
    pagination,
  };
}
