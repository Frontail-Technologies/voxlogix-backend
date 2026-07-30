import {
  and,
  asc,
  count,
  eq,
  ilike,
  inArray,
  or,
  type SQL,
} from "drizzle-orm";

import { db } from "@/db";
import { companyModuleAccess, moduleFields, modules, moduleTypes } from "@/db/schema";
import type {
  CreateModuleInput,
  ListModulesInput,
  ModuleFieldInput,
  ModuleListRow,
  UpdateModuleFieldInput,
  UpdateModuleInput,
} from "@/modules/modules/module.types";
import { AppError } from "@/shared/errors/app-error";
import { ERROR_CODES } from "@/shared/errors/error-codes";
import { HTTP_STATUS } from "@/shared/errors/http-status";
import { buildPagination } from "@/shared/helpers/pagination";
import { sanitizeString } from "@/shared/helpers/sanitize";
import { toCamelKey, toSlug } from "@/shared/helpers/slug";
import { USER_ROLES } from "@/shared/constants";
import { createPlatformActivity } from "@/shared/services/activity-log.service";

function buildModulesFilter({
  search,
  status,
  moduleTypeId,
}: Omit<ListModulesInput, "page" | "limit" | "companyId" | "role">) {
  const filters: SQL<unknown>[] = [];

  if (search) {
    filters.push(
      or(
        ilike(modules.name, `%${search}%`),
        ilike(modules.category, `%${search}%`),
      )!,
    );
  }

  if (status) {
    filters.push(eq(modules.status, status as typeof modules.$inferSelect.status));
  }

  if (moduleTypeId) {
    filters.push(eq(modules.moduleTypeId, moduleTypeId));
  }

  if (!filters.length) {
    return undefined;
  }

  return and(...filters);
}

async function enabledModuleIdsForCompany(companyId: string) {
  const rows = await db
    .select({ moduleId: companyModuleAccess.moduleId })
    .from(companyModuleAccess)
    .where(and(eq(companyModuleAccess.companyId, companyId), eq(companyModuleAccess.enabled, true)));

  return rows.map((row) => row.moduleId);
}

function shouldFilterByCompanyAccess(input: ListModulesInput) {
  return Boolean(input.companyId) && input.role !== USER_ROLES.MASTER;
}
async function ensureModuleTypeExists(moduleTypeId: string) {
  const [existing] = await db
    .select({ id: moduleTypes.id })
    .from(moduleTypes)
    .where(eq(moduleTypes.id, moduleTypeId))
    .limit(1);

  if (!existing) {
    throw new AppError({
      message: "Selected module type does not exist.",
      statusCode: HTTP_STATUS.BAD_REQUEST,
      errorCode: ERROR_CODES.VALIDATION_ERROR,
    });
  }
}

async function ensureModuleExists(moduleId: string) {
  const [existing] = await db
    .select({ id: modules.id })
    .from(modules)
    .where(eq(modules.id, moduleId))
    .limit(1);

  if (!existing) {
    throw new AppError({
      message: "Module not found.",
      statusCode: HTTP_STATUS.NOT_FOUND,
      errorCode: ERROR_CODES.NOT_FOUND,
    });
  }
}

async function ensureFieldExists(moduleId: string, fieldId: string) {
  const [existing] = await db
    .select({ id: moduleFields.id })
    .from(moduleFields)
    .where(and(eq(moduleFields.moduleId, moduleId), eq(moduleFields.id, fieldId)))
    .limit(1);

  if (!existing) {
    throw new AppError({
      message: "Module field not found.",
      statusCode: HTTP_STATUS.NOT_FOUND,
      errorCode: ERROR_CODES.NOT_FOUND,
    });
  }
}

async function ensureModuleNameUnique(name: string, excludeModuleId?: string) {
  const slug = toSlug(name);
  const matches = await db
    .select({ id: modules.id })
    .from(modules)
    .where(eq(modules.slug, slug));

  const conflict = matches.find((item) => item.id !== excludeModuleId);

  if (conflict) {
    throw new AppError({
      message: "A module with the same name already exists.",
      statusCode: HTTP_STATUS.CONFLICT,
      errorCode: ERROR_CODES.CONFLICT,
    });
  }
}

async function ensureFieldKeyUnique(
  moduleId: string,
  key: string,
  excludeFieldId?: string,
) {
  const matches = await db
    .select({ id: moduleFields.id })
    .from(moduleFields)
    .where(and(eq(moduleFields.moduleId, moduleId), eq(moduleFields.key, key)));

  const conflict = matches.find((item) => item.id !== excludeFieldId);

  if (conflict) {
    throw new AppError({
      message: "A field with the same key already exists for this module.",
      statusCode: HTTP_STATUS.CONFLICT,
      errorCode: ERROR_CODES.CONFLICT,
    });
  }
}

function mapModuleListItem(row: ModuleListRow) {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    moduleTypeId: row.moduleTypeId,
    type: row.type,
    category: row.category,
    status: row.status,
    availabilityText: row.availabilityText,
    icon: row.icon,
    color: row.color,
    mediaUrl: row.mediaUrl,
    mediaKey: row.mediaKey,
    description: row.description,
    voiceEnabled: row.voiceEnabled,
    feedEnabled: row.feedEnabled,
    feedOnlyOnAlert: row.feedOnlyOnAlert,
    requiresVoicePlayback: row.requiresVoicePlayback,
    maxAttachments: row.maxAttachments,
    fieldsCount: row.fieldsCount,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

async function syncModuleFieldsCount(moduleId: string) {
  const [{ total }] = await db
    .select({ total: count() })
    .from(moduleFields)
    .where(eq(moduleFields.moduleId, moduleId));

  await db
    .update(modules)
    .set({ fieldsCount: total, updatedAt: new Date() })
    .where(eq(modules.id, moduleId));
}

export async function listModules(input: ListModulesInput) {
  const filters: SQL<unknown>[] = [];
  const baseWhere = buildModulesFilter(input);
  if (baseWhere) filters.push(baseWhere);

  if (shouldFilterByCompanyAccess(input) && input.companyId) {
    const enabledModuleIds = await enabledModuleIdsForCompany(input.companyId);
    if (!enabledModuleIds.length) {
      const pagination = buildPagination({ page: input.page, limit: input.limit, totalItems: 0 });
      return { items: [], pagination };
    }
    filters.push(inArray(modules.id, enabledModuleIds));
  }

  const where = filters.length ? and(...filters) : undefined;

  const [{ totalItems }] = await db
    .select({ totalItems: count() })
    .from(modules)
    .where(where);

  const pagination = buildPagination({
    page: input.page,
    limit: input.limit,
    totalItems,
  });

  const rows = await db
    .select({
      id: modules.id,
      name: modules.name,
      slug: modules.slug,
      moduleTypeId: modules.moduleTypeId,
      type: moduleTypes.name,
      category: modules.category,
      status: modules.status,
      availabilityText: modules.availabilityText,
      icon: modules.icon,
      color: modules.color,
      mediaUrl: modules.mediaUrl,
      mediaKey: modules.mediaKey,
      description: modules.description,
      voiceEnabled: modules.voiceEnabled,
      feedEnabled: modules.feedEnabled,
      feedOnlyOnAlert: modules.feedOnlyOnAlert,
      requiresVoicePlayback: modules.requiresVoicePlayback,
      maxAttachments: modules.maxAttachments,
      fieldsCount: modules.fieldsCount,
      createdAt: modules.createdAt,
      updatedAt: modules.updatedAt,
    })
    .from(modules)
    .innerJoin(moduleTypes, eq(modules.moduleTypeId, moduleTypes.id))
    .where(where)
    .orderBy(asc(modules.name))
    .limit(pagination.limit)
    .offset(pagination.offset);

  return {
    items: rows.map(mapModuleListItem),
    pagination,
  };
}

export async function getModuleById(moduleId: string) {
  const [module] = await db
    .select({
      id: modules.id,
      name: modules.name,
      slug: modules.slug,
      moduleTypeId: modules.moduleTypeId,
      type: moduleTypes.name,
      category: modules.category,
      status: modules.status,
      availabilityText: modules.availabilityText,
      icon: modules.icon,
      color: modules.color,
      mediaUrl: modules.mediaUrl,
      mediaKey: modules.mediaKey,
      description: modules.description,
      promptPreview: modules.promptPreview,
      voiceEnabled: modules.voiceEnabled,
      feedEnabled: modules.feedEnabled,
      feedOnlyOnAlert: modules.feedOnlyOnAlert,
      requiresVoicePlayback: modules.requiresVoicePlayback,
      maxAttachments: modules.maxAttachments,
      fieldsCount: modules.fieldsCount,
      createdAt: modules.createdAt,
      updatedAt: modules.updatedAt,
    })
    .from(modules)
    .innerJoin(moduleTypes, eq(modules.moduleTypeId, moduleTypes.id))
    .where(eq(modules.id, moduleId))
    .limit(1);

  if (!module) {
    throw new AppError({
      message: "Module not found.",
      statusCode: HTTP_STATUS.NOT_FOUND,
      errorCode: ERROR_CODES.NOT_FOUND,
    });
  }

  const fields = await getModuleFields(moduleId);

  return {
    ...mapModuleListItem(module),
    promptPreview: module.promptPreview,
    fields,
  };
}

export async function createModule(input: CreateModuleInput) {
  const name = sanitizeString(input.name);
  await ensureModuleNameUnique(name);
  await ensureModuleTypeExists(input.moduleTypeId);

  const [created] = await db
    .insert(modules)
    .values({
      name,
      slug: toSlug(name),
      moduleTypeId: input.moduleTypeId,
      category: sanitizeString(input.category),
      status: input.status as typeof modules.$inferInsert.status,
      availabilityText: sanitizeString(input.availabilityText),
      icon: sanitizeString(input.icon),
      color: input.color,
      description: input.description ? sanitizeString(input.description) : null,
      mediaUrl: input.mediaUrl ?? null,
      mediaKey: input.mediaKey ?? null,
      promptPreview: input.promptPreview?.trim() || null,
      voiceEnabled: input.voiceEnabled,
      feedEnabled: input.feedEnabled,
      feedOnlyOnAlert: input.feedOnlyOnAlert,
      requiresVoicePlayback: input.requiresVoicePlayback,
      maxAttachments: input.maxAttachments,
      fieldsCount: input.fields?.length ?? 0,
      updatedAt: new Date(),
    })
    .returning({ id: modules.id });

  if (input.fields?.length) {
    const now = new Date();
    await db.insert(moduleFields).values(
      input.fields.map((field) => ({
        moduleId: created.id,
        label: sanitizeString(field.label),
        key: field.key ? sanitizeString(field.key) : toCamelKey(field.label),
        type: field.type,
        required: field.required,
        aiExtract: field.aiExtract,
        sourceType: field.sourceType,
        sourceKey: field.sourceKey ?? null,
        feedVisible: field.feedVisible,
        reportVisible: field.reportVisible,
        validationRules: field.validationRules ?? null,
        sortOrder: field.sortOrder,
        options: field.options ?? null,
        createdAt: now,
        updatedAt: now,
      })),
    );
  }

  await syncModuleFieldsCount(created.id);
  await createPlatformActivity({
    event: `Module "${name}" created`,
    area: "Modules",
    action: "Created",
    status: "Success",
    companyNameSnapshot: "Platform",
  });

  return getModuleById(created.id);
}

export async function updateModule(moduleId: string, input: UpdateModuleInput) {
  await ensureModuleExists(moduleId);
  const currentModule = await getModuleById(moduleId);

  if (input.name) {
    await ensureModuleNameUnique(sanitizeString(input.name), moduleId);
  }

  const updatePayload: Partial<typeof modules.$inferInsert> = {
    updatedAt: new Date(),
  };

  if (input.name) {
    const name = sanitizeString(input.name);
    updatePayload.name = name;
    updatePayload.slug = toSlug(name);
  }

  if (input.moduleTypeId) {
    await ensureModuleTypeExists(input.moduleTypeId);
    updatePayload.moduleTypeId = input.moduleTypeId;
  }

  if (input.category) {
    updatePayload.category = sanitizeString(input.category);
  }

  if (input.status) {
    updatePayload.status = input.status as typeof modules.$inferInsert.status;
  }

  if (input.availabilityText) {
    updatePayload.availabilityText = sanitizeString(input.availabilityText);
  }

  if (input.icon) {
    updatePayload.icon = sanitizeString(input.icon);
  }

  if (input.color) {
    updatePayload.color = input.color;
  }

  if (typeof input.description === "string") {
    updatePayload.description = sanitizeString(input.description);
  }

  if (input.mediaUrl !== undefined) {
    updatePayload.mediaUrl = input.mediaUrl;
  }

  if (input.mediaKey !== undefined) {
    updatePayload.mediaKey = input.mediaKey;
  }

  if (typeof input.promptPreview === "string") {
    updatePayload.promptPreview = input.promptPreview.trim();
  }

  if (typeof input.voiceEnabled === "boolean") {
    updatePayload.voiceEnabled = input.voiceEnabled;
  }

  if (typeof input.feedEnabled === "boolean") {
    updatePayload.feedEnabled = input.feedEnabled;
  }

  if (typeof input.feedOnlyOnAlert === "boolean") {
    updatePayload.feedOnlyOnAlert = input.feedOnlyOnAlert;
  }

  if (typeof input.requiresVoicePlayback === "boolean") {
    updatePayload.requiresVoicePlayback = input.requiresVoicePlayback;
  }

  if (typeof input.maxAttachments === "number") {
    updatePayload.maxAttachments = input.maxAttachments;
  }

  await db.update(modules).set(updatePayload).where(eq(modules.id, moduleId));

  await createPlatformActivity({
    event: `Module "${updatePayload.name ?? currentModule.name}" updated`,
    area: "Modules",
    action: "Updated",
    status: "Success",
    companyNameSnapshot: "Platform",
  });

  return getModuleById(moduleId);
}

export async function deleteModule(moduleId: string) {
  const currentModule = await getModuleById(moduleId);
  await db.delete(modules).where(eq(modules.id, moduleId));
  await createPlatformActivity({
    event: `Module "${currentModule.name}" deleted`,
    area: "Modules",
    action: "Deleted",
    status: "Warning",
    companyNameSnapshot: "Platform",
  });
  return { id: moduleId };
}

export async function getModuleFields(moduleId: string) {
  await ensureModuleExists(moduleId);

  const rows = await db
    .select({
      id: moduleFields.id,
      moduleId: moduleFields.moduleId,
      label: moduleFields.label,
      key: moduleFields.key,
      type: moduleFields.type,
      required: moduleFields.required,
      aiExtract: moduleFields.aiExtract,
      sourceType: moduleFields.sourceType,
      sourceKey: moduleFields.sourceKey,
      feedVisible: moduleFields.feedVisible,
      reportVisible: moduleFields.reportVisible,
      validationRules: moduleFields.validationRules,
      sortOrder: moduleFields.sortOrder,
      options: moduleFields.options,
      createdAt: moduleFields.createdAt,
      updatedAt: moduleFields.updatedAt,
    })
    .from(moduleFields)
    .where(eq(moduleFields.moduleId, moduleId))
    .orderBy(asc(moduleFields.sortOrder), asc(moduleFields.label));

  return rows;
}

export async function createModuleField(
  moduleId: string,
  input: ModuleFieldInput,
) {
  await ensureModuleExists(moduleId);
  const key = input.key ? sanitizeString(input.key) : toCamelKey(input.label);
  await ensureFieldKeyUnique(moduleId, key);

  const [created] = await db
    .insert(moduleFields)
    .values({
      moduleId,
      label: sanitizeString(input.label),
      key,
      type: input.type,
      required: input.required,
      aiExtract: input.aiExtract,
      sourceType: input.sourceType,
      sourceKey: input.sourceKey ?? null,
      feedVisible: input.feedVisible,
      reportVisible: input.reportVisible,
      validationRules: input.validationRules ?? null,
      sortOrder: input.sortOrder,
      options: input.options ?? null,
      updatedAt: new Date(),
    })
    .returning({ id: moduleFields.id });

  await syncModuleFieldsCount(moduleId);
  await createPlatformActivity({
    event: `Field "${input.label}" added to module`,
    area: "Modules",
    action: "Created",
    status: "Success",
    companyNameSnapshot: "Platform",
  });

  const fields = await getModuleFields(moduleId);
  return fields.find((field) => field.id === created.id) ?? null;
}

export async function updateModuleField(
  moduleId: string,
  fieldId: string,
  input: UpdateModuleFieldInput,
) {
  await ensureModuleExists(moduleId);
  await ensureFieldExists(moduleId, fieldId);

  if (input.key) {
    await ensureFieldKeyUnique(moduleId, sanitizeString(input.key), fieldId);
  }

  const updatePayload: Partial<typeof moduleFields.$inferInsert> = {
    updatedAt: new Date(),
  };

  if (input.label) {
    updatePayload.label = sanitizeString(input.label);
  }

  if (input.key) {
    updatePayload.key = sanitizeString(input.key);
  }

  if (input.type) {
    updatePayload.type = input.type;
  }

  if (typeof input.required === "boolean") {
    updatePayload.required = input.required;
  }

  if (typeof input.aiExtract === "boolean") {
    updatePayload.aiExtract = input.aiExtract;
  }

  if (input.sourceType) {
    updatePayload.sourceType = input.sourceType;
  }

  if (input.sourceKey !== undefined) {
    updatePayload.sourceKey = input.sourceKey;
  }

  if (typeof input.feedVisible === "boolean") {
    updatePayload.feedVisible = input.feedVisible;
  }

  if (typeof input.reportVisible === "boolean") {
    updatePayload.reportVisible = input.reportVisible;
  }

  if (input.validationRules !== undefined) {
    updatePayload.validationRules = input.validationRules;
  }

  if (typeof input.sortOrder === "number") {
    updatePayload.sortOrder = input.sortOrder;
  }

  if (input.options) {
    updatePayload.options = input.options;
  }

  await db
    .update(moduleFields)
    .set(updatePayload)
    .where(and(eq(moduleFields.moduleId, moduleId), eq(moduleFields.id, fieldId)));

  await createPlatformActivity({
    event: `Module field updated`,
    area: "Modules",
    action: "Updated",
    status: "Success",
    companyNameSnapshot: "Platform",
  });

  const fields = await getModuleFields(moduleId);
  return fields.find((field) => field.id === fieldId) ?? null;
}

export async function deleteModuleField(moduleId: string, fieldId: string) {
  await ensureModuleExists(moduleId);
  await ensureFieldExists(moduleId, fieldId);

  await db
    .delete(moduleFields)
    .where(and(eq(moduleFields.moduleId, moduleId), eq(moduleFields.id, fieldId)));

  await syncModuleFieldsCount(moduleId);
  await createPlatformActivity({
    event: `Module field deleted`,
    area: "Modules",
    action: "Deleted",
    status: "Warning",
    companyNameSnapshot: "Platform",
  });

  return { id: fieldId, moduleId };
}
