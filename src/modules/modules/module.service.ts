import {
  and,
  asc,
  count,
  eq,
  ilike,
  or,
  type SQL,
} from "drizzle-orm";

import { db } from "@/db";
import { moduleFields, modules } from "@/db/schema";
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
import { toSlug } from "@/shared/helpers/slug";

function buildModulesFilter({
  search,
  status,
  type,
}: Omit<ListModulesInput, "page" | "limit">) {
  const filters: SQL<unknown>[] = [];

  if (search) {
    filters.push(
      or(
        ilike(modules.name, `%${search}%`),
        ilike(modules.category, `%${search}%`),
        ilike(modules.type, `%${search}%`),
      )!,
    );
  }

  if (status) {
    filters.push(eq(modules.status, status as typeof modules.$inferSelect.status));
  }

  if (type) {
    filters.push(eq(modules.type, type as typeof modules.$inferSelect.type));
  }

  if (!filters.length) {
    return undefined;
  }

  return and(...filters);
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
    type: row.type,
    category: row.category,
    status: row.status,
    availabilityText: row.availabilityText,
    icon: row.icon,
    color: row.color,
    description: row.description,
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
  const where = buildModulesFilter(input);

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
      type: modules.type,
      category: modules.category,
      status: modules.status,
      availabilityText: modules.availabilityText,
      icon: modules.icon,
      color: modules.color,
      description: modules.description,
      fieldsCount: modules.fieldsCount,
      createdAt: modules.createdAt,
      updatedAt: modules.updatedAt,
    })
    .from(modules)
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
      type: modules.type,
      category: modules.category,
      status: modules.status,
      availabilityText: modules.availabilityText,
      icon: modules.icon,
      color: modules.color,
      description: modules.description,
      promptPreview: modules.promptPreview,
      fieldsCount: modules.fieldsCount,
      createdAt: modules.createdAt,
      updatedAt: modules.updatedAt,
    })
    .from(modules)
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

  const [created] = await db
    .insert(modules)
    .values({
      name,
      slug: toSlug(name),
      type: input.type as typeof modules.$inferInsert.type,
      category: sanitizeString(input.category),
      status: input.status as typeof modules.$inferInsert.status,
      availabilityText: sanitizeString(input.availabilityText),
      icon: sanitizeString(input.icon),
      color: input.color,
      description: input.description ? sanitizeString(input.description) : null,
      promptPreview: input.promptPreview?.trim() || null,
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
        key: sanitizeString(field.key),
        type: field.type,
        required: field.required,
        aiExtract: field.aiExtract,
        sortOrder: field.sortOrder,
        options: field.options ?? null,
        createdAt: now,
        updatedAt: now,
      })),
    );
  }

  await syncModuleFieldsCount(created.id);

  return getModuleById(created.id);
}

export async function updateModule(moduleId: string, input: UpdateModuleInput) {
  await ensureModuleExists(moduleId);

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

  if (input.type) {
    updatePayload.type = input.type as typeof modules.$inferInsert.type;
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

  if (typeof input.promptPreview === "string") {
    updatePayload.promptPreview = input.promptPreview.trim();
  }

  await db.update(modules).set(updatePayload).where(eq(modules.id, moduleId));

  return getModuleById(moduleId);
}

export async function deleteModule(moduleId: string) {
  await ensureModuleExists(moduleId);
  await db.delete(modules).where(eq(modules.id, moduleId));
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
  await ensureFieldKeyUnique(moduleId, sanitizeString(input.key));

  const [created] = await db
    .insert(moduleFields)
    .values({
      moduleId,
      label: sanitizeString(input.label),
      key: sanitizeString(input.key),
      type: input.type,
      required: input.required,
      aiExtract: input.aiExtract,
      sortOrder: input.sortOrder,
      options: input.options ?? null,
      updatedAt: new Date(),
    })
    .returning({ id: moduleFields.id });

  await syncModuleFieldsCount(moduleId);

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

  return { id: fieldId, moduleId };
}
