import { and, asc, count, eq, ilike, type SQL } from "drizzle-orm";

import { db } from "@/db";
import { moduleTypes, modules } from "@/db/schema";
import type {
  CreateModuleTypeInput,
  ListModuleTypesInput,
  UpdateModuleTypeInput,
} from "@/modules/module-types/module-type.types";
import { AppError } from "@/shared/errors/app-error";
import { ERROR_CODES } from "@/shared/errors/error-codes";
import { HTTP_STATUS } from "@/shared/errors/http-status";
import { buildPagination } from "@/shared/helpers/pagination";
import { sanitizeString } from "@/shared/helpers/sanitize";
import { toSlug } from "@/shared/helpers/slug";
import { createPlatformActivity } from "@/shared/services/activity-log.service";

function buildFilter({ search, status }: Omit<ListModuleTypesInput, "page" | "limit">) {
  const filters: SQL<unknown>[] = [];

  if (search) filters.push(ilike(moduleTypes.name, `%${search}%`));
  if (status) filters.push(eq(moduleTypes.status, status));

  if (!filters.length) return undefined;
  return and(...filters);
}

async function ensureModuleTypeExists(moduleTypeId: string) {
  const [existing] = await db
    .select({ id: moduleTypes.id })
    .from(moduleTypes)
    .where(eq(moduleTypes.id, moduleTypeId))
    .limit(1);

  if (!existing) {
    throw new AppError({
      message: "Module type not found.",
      statusCode: HTTP_STATUS.NOT_FOUND,
      errorCode: ERROR_CODES.NOT_FOUND,
    });
  }
}

async function ensureModuleTypeNameUnique(name: string, excludeModuleTypeId?: string) {
  const slug = toSlug(name);
  const matches = await db
    .select({ id: moduleTypes.id })
    .from(moduleTypes)
    .where(eq(moduleTypes.slug, slug));

  const conflict = matches.find((item) => item.id !== excludeModuleTypeId);

  if (conflict) {
    throw new AppError({
      message: "A module type with the same name already exists.",
      statusCode: HTTP_STATUS.CONFLICT,
      errorCode: ERROR_CODES.CONFLICT,
    });
  }
}

export async function listModuleTypes(input: ListModuleTypesInput) {
  const where = buildFilter(input);

  const [{ totalItems }] = await db.select({ totalItems: count() }).from(moduleTypes).where(where);

  const pagination = buildPagination({
    page: input.page,
    limit: input.limit,
    totalItems,
  });

  const items = await db
    .select()
    .from(moduleTypes)
    .where(where)
    .orderBy(asc(moduleTypes.name))
    .limit(pagination.limit)
    .offset(pagination.offset);

  return { items, pagination };
}

export async function getModuleType(moduleTypeId: string) {
  const [item] = await db.select().from(moduleTypes).where(eq(moduleTypes.id, moduleTypeId)).limit(1);

  if (!item) {
    throw new AppError({
      message: "Module type not found.",
      statusCode: HTTP_STATUS.NOT_FOUND,
      errorCode: ERROR_CODES.NOT_FOUND,
    });
  }

  return item;
}

export async function createModuleType(input: CreateModuleTypeInput) {
  const name = sanitizeString(input.name);
  await ensureModuleTypeNameUnique(name);

  const [created] = await db
    .insert(moduleTypes)
    .values({
      name,
      slug: toSlug(name),
      description: input.description ? sanitizeString(input.description) : null,
      status: input.status,
      updatedAt: new Date(),
    })
    .returning({ id: moduleTypes.id });

  await createPlatformActivity({
    event: `Module type "${name}" created`,
    area: "Modules",
    action: "Created",
    status: "Success",
    companyNameSnapshot: "Platform",
  });

  return getModuleType(created.id);
}

export async function updateModuleType(moduleTypeId: string, input: UpdateModuleTypeInput) {
  await ensureModuleTypeExists(moduleTypeId);

  const updatePayload: Partial<typeof moduleTypes.$inferInsert> = {
    updatedAt: new Date(),
  };

  if (input.name) {
    const name = sanitizeString(input.name);
    await ensureModuleTypeNameUnique(name, moduleTypeId);
    updatePayload.name = name;
    updatePayload.slug = toSlug(name);
  }

  if (typeof input.description === "string") {
    updatePayload.description = sanitizeString(input.description);
  }

  if (input.status) {
    updatePayload.status = input.status;
  }

  await db.update(moduleTypes).set(updatePayload).where(eq(moduleTypes.id, moduleTypeId));

  await createPlatformActivity({
    event: "Module type updated",
    area: "Modules",
    action: "Updated",
    status: "Success",
    companyNameSnapshot: "Platform",
  });

  return getModuleType(moduleTypeId);
}

export async function deleteModuleType(moduleTypeId: string) {
  const current = await getModuleType(moduleTypeId);

  const [{ total }] = await db.select({ total: count() }).from(modules).where(eq(modules.moduleTypeId, moduleTypeId));

  if (total > 0) {
    throw new AppError({
      message: `Cannot delete "${current.name}" while ${total} module(s) still use this type. Reassign or delete those modules first.`,
      statusCode: HTTP_STATUS.CONFLICT,
      errorCode: ERROR_CODES.CONFLICT,
    });
  }

  await db.delete(moduleTypes).where(eq(moduleTypes.id, moduleTypeId));

  await createPlatformActivity({
    event: `Module type "${current.name}" deleted`,
    area: "Modules",
    action: "Deleted",
    status: "Warning",
    companyNameSnapshot: "Platform",
  });

  return { id: moduleTypeId };
}
