import { and, asc, count, desc, eq, gte, ilike, lte, or, sql, type SQL } from "drizzle-orm";

import { db } from "@/db";
import {
  admins,
  equipmentAssets,
  logAttachments,
  logTimelineEvents,
  modules,
  moduleTypes,
  operationalLogs,
} from "@/db/schema";
import type {
  CreateLogAttachmentInput,
  CreateLogInput,
  ListLogsInput,
  UpdateLogInput,
  UpdateLogStatusInput,
} from "@/modules/logs/log.types";
import { AppError } from "@/shared/errors/app-error";
import { ERROR_CODES } from "@/shared/errors/error-codes";
import { HTTP_STATUS } from "@/shared/errors/http-status";
import { buildPagination } from "@/shared/helpers/pagination";
import { sanitizeString } from "@/shared/helpers/sanitize";

function buildLogsFilter(input: Omit<ListLogsInput, "page" | "limit">) {
  const filters: SQL<unknown>[] = [eq(operationalLogs.companyId, input.companyId)];

  if (input.search) {
    filters.push(
      or(
        ilike(operationalLogs.logNumber, `%${input.search}%`),
        ilike(operationalLogs.title, `%${input.search}%`),
        ilike(operationalLogs.issueCategory, `%${input.search}%`),
        ilike(equipmentAssets.name, `%${input.search}%`),
        ilike(equipmentAssets.equipmentCode, `%${input.search}%`),
      )!,
    );
  }

  if (input.status) filters.push(eq(operationalLogs.status, input.status));
  if (input.severity) filters.push(eq(operationalLogs.severity, input.severity));
  if (input.moduleType) filters.push(eq(operationalLogs.moduleType, input.moduleType));
  if (input.equipmentId) filters.push(eq(operationalLogs.equipmentId, input.equipmentId));
  if (input.createdById) filters.push(eq(operationalLogs.createdById, input.createdById));
  if (input.scope === "feed") {
    const structuredReadingAlertCondition = sql<boolean>`(
      (
        ${operationalLogs.extractedFields}->>'readingType' = 'MEASURING_POINT'
        and lower(coalesce(${operationalLogs.extractedFields}->>'isAlert', '')) = 'true'
        and ${operationalLogs.extractedFields}->>'measurementStatus' = 'OUT_OF_LIMIT'
      )
      or (
        ${operationalLogs.extractedFields}->>'readingType' = 'METER_COUNTER'
        and lower(coalesce(${operationalLogs.extractedFields}->>'isAlert', '')) = 'true'
        and ${operationalLogs.extractedFields}->>'counterStatus' = 'HIGH_DEVIATION'
      )
    )`;
    const legacyAlertCondition = sql<boolean>`(
      coalesce(${operationalLogs.extractedFields}->>'readingType', '') = ''
      and (
      lower(${operationalLogs.severity}) in ('critical', 'high')
      or lower(${operationalLogs.status}) in ('alert', 'abnormal', 'out_of_limit', 'out of limit', 'high_deviation', 'high deviation')
      or lower(coalesce(${operationalLogs.extractedFields}->>'isOutOfLimit', '')) in ('true', 'yes', 'out_of_limit', 'out of limit')
      or lower(coalesce(${operationalLogs.extractedFields}->>'deviationFlag', '')) in ('true', 'yes', 'alert', 'abnormal', 'out_of_limit', 'out of limit', 'high_deviation', 'high deviation')
      )
    )`;

    filters.push(
      sql<boolean>`(
        ${modules.feedEnabled} = true
        or (${modules.feedOnlyOnAlert} = true and (${structuredReadingAlertCondition} or ${legacyAlertCondition}))
      )`,
    );
  }
  if (input.dateFrom) filters.push(gte(operationalLogs.createdAt, input.dateFrom));
  if (input.dateTo) filters.push(lte(operationalLogs.createdAt, input.dateTo));

  return and(...filters);
}

function normalizeModuleLabel(value?: string | null) {
  return value?.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim() ?? "";
}

async function getModuleForLog(input: Pick<CreateLogInput, "companyId" | "moduleId" | "moduleType">) {
  if (input.moduleId) {
    const [module] = await db
      .select({ id: modules.id, name: modules.name, type: moduleTypes.name })
      .from(modules)
      .leftJoin(moduleTypes, eq(modules.moduleTypeId, moduleTypes.id))
      .where(eq(modules.id, input.moduleId))
      .limit(1);

    if (module) return module;
  }

  return {
    id: input.moduleId ?? null,
    name: input.moduleType,
    type: input.moduleType,
  };
}

function requiresEquipment(moduleNameOrType?: string | null) {
  const normalized = normalizeModuleLabel(moduleNameOrType);
  return normalized.includes("equipment") && !normalized.includes("measurement") && !normalized.includes("meter");
}

function makeLogNumber() {
  return `LOG-${Date.now().toString().slice(-8)}`;
}

async function ensureLog(companyId: string, logId: string) {
  const [existing] = await db
    .select({ id: operationalLogs.id })
    .from(operationalLogs)
    .where(and(eq(operationalLogs.id, logId), eq(operationalLogs.companyId, companyId)))
    .limit(1);

  if (!existing) {
    throw new AppError({ message: "Log not found.", statusCode: HTTP_STATUS.NOT_FOUND, errorCode: ERROR_CODES.NOT_FOUND });
  }
}

export async function listLogs(input: ListLogsInput) {
  const where = buildLogsFilter(input);
  const [{ totalItems }] = await db
    .select({ totalItems: count() })
    .from(operationalLogs)
    .leftJoin(equipmentAssets, eq(operationalLogs.equipmentId, equipmentAssets.id))
    .leftJoin(modules, eq(operationalLogs.moduleId, modules.id))
    .where(where);
  const pagination = buildPagination({ page: input.page, limit: input.limit, totalItems });

  const rows = await db
    .select({
      id: operationalLogs.id,
      logNumber: operationalLogs.logNumber,
      moduleType: operationalLogs.moduleType,
      title: operationalLogs.title,
      issueCategory: operationalLogs.issueCategory,
      severity: operationalLogs.severity,
      status: operationalLogs.status,
      aiProcessed: operationalLogs.aiProcessed,
      downtimeMinutes: operationalLogs.downtimeMinutes,
      extractedFields: operationalLogs.extractedFields,
      createdAt: operationalLogs.createdAt,
      updatedAt: operationalLogs.updatedAt,
      thumbnailUrl: sql<string | null>`(
        SELECT ${logAttachments.url} FROM ${logAttachments}
        WHERE ${logAttachments.logId} = ${operationalLogs.id}
          AND ${logAttachments.mimeType} LIKE 'image/%'
        ORDER BY ${logAttachments.sortOrder} ASC
        LIMIT 1
      )`,
      equipment: {
        id: equipmentAssets.id,
        equipmentCode: equipmentAssets.equipmentCode,
        name: equipmentAssets.name,
        section: equipmentAssets.section,
        subLocation: equipmentAssets.subLocation,
      },
      createdBy: {
        id: admins.id,
        fullName: admins.fullName,
        initials: admins.initials,
      },
    })
    .from(operationalLogs)
    .leftJoin(equipmentAssets, eq(operationalLogs.equipmentId, equipmentAssets.id))
    .leftJoin(admins, eq(operationalLogs.createdById, admins.id))
    .leftJoin(modules, eq(operationalLogs.moduleId, modules.id))
    .where(where)
    .orderBy(desc(operationalLogs.createdAt))
    .limit(pagination.limit)
    .offset(pagination.offset);

  return { items: rows, pagination };
}

export async function getLog(companyId: string, logId: string) {
  const [row] = await db
    .select({
      id: operationalLogs.id,
      logNumber: operationalLogs.logNumber,
      moduleType: operationalLogs.moduleType,
      title: operationalLogs.title,
      description: operationalLogs.description,
      transcript: operationalLogs.transcript,
      issueCategory: operationalLogs.issueCategory,
      severity: operationalLogs.severity,
      status: operationalLogs.status,
      aiProcessed: operationalLogs.aiProcessed,
      voiceDurationSeconds: operationalLogs.voiceDurationSeconds,
      voiceRecordingUrl: operationalLogs.voiceRecordingUrl,
      voiceRecordingKey: operationalLogs.voiceRecordingKey,
      downtimeMinutes: operationalLogs.downtimeMinutes,
      extractedFields: operationalLogs.extractedFields,
      capturedLatitude: operationalLogs.capturedLatitude,
      capturedLongitude: operationalLogs.capturedLongitude,
      capturedAddress: operationalLogs.capturedAddress,
      createdAt: operationalLogs.createdAt,
      updatedAt: operationalLogs.updatedAt,
      module: { id: modules.id, name: modules.name, type: moduleTypes.name },
      equipment: {
        id: equipmentAssets.id,
        equipmentCode: equipmentAssets.equipmentCode,
        name: equipmentAssets.name,
        section: equipmentAssets.section,
        subLocation: equipmentAssets.subLocation,
      },
      createdBy: { id: admins.id, fullName: admins.fullName, initials: admins.initials },
    })
    .from(operationalLogs)
    .leftJoin(modules, eq(operationalLogs.moduleId, modules.id))
    .leftJoin(moduleTypes, eq(modules.moduleTypeId, moduleTypes.id))
    .leftJoin(equipmentAssets, eq(operationalLogs.equipmentId, equipmentAssets.id))
    .leftJoin(admins, eq(operationalLogs.createdById, admins.id))
    .where(and(eq(operationalLogs.id, logId), eq(operationalLogs.companyId, companyId)))
    .limit(1);

  if (!row) {
    throw new AppError({ message: "Log not found.", statusCode: HTTP_STATUS.NOT_FOUND, errorCode: ERROR_CODES.NOT_FOUND });
  }

  const attachments = await db
    .select()
    .from(logAttachments)
    .where(eq(logAttachments.logId, logId))
    .orderBy(asc(logAttachments.sortOrder), asc(logAttachments.createdAt));

  const timeline = await db
    .select()
    .from(logTimelineEvents)
    .where(eq(logTimelineEvents.logId, logId))
    .orderBy(asc(logTimelineEvents.createdAt));

  return { ...row, attachments, timeline };
}

export async function createLog(input: CreateLogInput) {
  const module = await getModuleForLog(input);
  const moduleLabel = module.name || module.type || input.moduleType;

  if (requiresEquipment(moduleLabel) && !input.equipmentId) {
    throw new AppError({
      message: "Equipment is required for Equipment Log.",
      statusCode: HTTP_STATUS.BAD_REQUEST,
      errorCode: ERROR_CODES.VALIDATION_ERROR,
    });
  }

  if (input.clientRequestId) {
    const [existing] = await db
      .select({ id: operationalLogs.id })
      .from(operationalLogs)
      .where(
        and(
          eq(operationalLogs.companyId, input.companyId),
          eq(operationalLogs.clientRequestId, input.clientRequestId),
        ),
      )
      .limit(1);

    if (existing) {
      return getLog(input.companyId, existing.id);
    }
  }

  const now = new Date();
  const [created] = await db
    .insert(operationalLogs)
    .values({
      companyId: input.companyId,
      clientRequestId: input.clientRequestId ?? null,
      moduleId: input.moduleId ?? null,
      equipmentId: input.equipmentId ?? null,
      createdById: input.createdById ?? null,
      assignedPlannerId: input.assignedPlannerId ?? null,
      logNumber: makeLogNumber(),
      moduleType: sanitizeString(input.moduleType),
      title: sanitizeString(input.title),
      description: input.description ? sanitizeString(input.description) : null,
      transcript: input.transcript ? input.transcript.trim() : null,
      issueCategory: input.issueCategory ? sanitizeString(input.issueCategory) : null,
      severity: input.severity,
      status: input.status,
      aiProcessed: input.aiProcessed ? 1 : 0,
      voiceDurationSeconds: input.voiceDurationSeconds,
      voiceRecordingUrl: input.voiceRecordingUrl ?? null,
      voiceRecordingKey: input.voiceRecordingKey ?? null,
      downtimeMinutes: input.downtimeMinutes,
      extractedFields: input.extractedFields,
      capturedLatitude: input.capturedLatitude === null || input.capturedLatitude === undefined ? null : String(input.capturedLatitude),
      capturedLongitude: input.capturedLongitude === null || input.capturedLongitude === undefined ? null : String(input.capturedLongitude),
      capturedAddress: input.capturedAddress ?? null,
      updatedAt: now,
    })
    .returning({ id: operationalLogs.id });

  await db.insert(logTimelineEvents).values({
    logId: created.id,
    actorId: input.createdById ?? null,
    actorNameSnapshot: input.createdByName ?? "System",
    event: "Log created",
    status: input.status,
  });

  return getLog(input.companyId, created.id);
}

export async function updateLog(companyId: string, logId: string, input: UpdateLogInput) {
  await ensureLog(companyId, logId);

  const updatePayload: Partial<typeof operationalLogs.$inferInsert> = { updatedAt: new Date() };
  if (input.moduleId !== undefined) updatePayload.moduleId = input.moduleId;
  if (input.equipmentId !== undefined) updatePayload.equipmentId = input.equipmentId;
  if (input.assignedPlannerId !== undefined) updatePayload.assignedPlannerId = input.assignedPlannerId;
  if (input.moduleType) updatePayload.moduleType = sanitizeString(input.moduleType);
  if (input.title) updatePayload.title = sanitizeString(input.title);
  if (input.description !== undefined) updatePayload.description = input.description ? sanitizeString(input.description) : null;
  if (input.transcript !== undefined) updatePayload.transcript = input.transcript ?? null;
  if (input.issueCategory !== undefined) updatePayload.issueCategory = input.issueCategory ? sanitizeString(input.issueCategory) : null;
  if (input.severity) updatePayload.severity = input.severity;
  if (input.status) updatePayload.status = input.status;
  if (input.aiProcessed !== undefined) updatePayload.aiProcessed = input.aiProcessed ? 1 : 0;
  if (input.voiceDurationSeconds !== undefined) updatePayload.voiceDurationSeconds = input.voiceDurationSeconds;
  if (input.voiceRecordingUrl !== undefined) updatePayload.voiceRecordingUrl = input.voiceRecordingUrl ?? null;
  if (input.voiceRecordingKey !== undefined) updatePayload.voiceRecordingKey = input.voiceRecordingKey ?? null;
  if (input.downtimeMinutes !== undefined) updatePayload.downtimeMinutes = input.downtimeMinutes;
  if (input.extractedFields !== undefined) updatePayload.extractedFields = input.extractedFields;
  if (input.capturedLatitude !== undefined) updatePayload.capturedLatitude = input.capturedLatitude === null ? null : String(input.capturedLatitude);
  if (input.capturedLongitude !== undefined) updatePayload.capturedLongitude = input.capturedLongitude === null ? null : String(input.capturedLongitude);
  if (input.capturedAddress !== undefined) updatePayload.capturedAddress = input.capturedAddress ?? null;

  await db.update(operationalLogs).set(updatePayload).where(and(eq(operationalLogs.id, logId), eq(operationalLogs.companyId, companyId)));
  return getLog(companyId, logId);
}

export async function updateLogStatus(companyId: string, logId: string, input: UpdateLogStatusInput) {
  await ensureLog(companyId, logId);
  await db
    .update(operationalLogs)
    .set({ status: input.status, updatedAt: new Date() })
    .where(and(eq(operationalLogs.id, logId), eq(operationalLogs.companyId, companyId)));

  await db.insert(logTimelineEvents).values({
    logId,
    actorId: input.actorId ?? null,
    actorNameSnapshot: input.actorName,
    event: `Status changed to ${input.status}`,
    status: input.status,
    notes: input.notes ?? null,
  });

  return getLog(companyId, logId);
}

export async function addLogAttachment(companyId: string, logId: string, input: CreateLogAttachmentInput) {
  await ensureLog(companyId, logId);
  const [created] = await db
    .insert(logAttachments)
    .values({
      logId,
      url: input.url,
      key: input.key ?? null,
      fileName: input.fileName ?? null,
      mimeType: input.mimeType ?? null,
      label: input.label ?? null,
      sortOrder: input.sortOrder,
    })
    .returning({ id: logAttachments.id });

  return (await getLog(companyId, logId)).attachments.find((item) => item.id === created.id) ?? null;
}

export async function deleteLogAttachment(companyId: string, logId: string, attachmentId: string) {
  await ensureLog(companyId, logId);
  await db.delete(logAttachments).where(and(eq(logAttachments.id, attachmentId), eq(logAttachments.logId, logId)));
  return { id: attachmentId, logId };
}
