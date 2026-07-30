import { and, asc, count, eq, ilike, type SQL } from "drizzle-orm";

import { db } from "@/db";
import { moduleCategories, modules } from "@/db/schema";
import type {
  CreateModuleCategoryInput,
  ListModuleCategoriesInput,
  UpdateModuleCategoryInput,
} from "@/modules/module-categories/module-category.types";
import { AppError } from "@/shared/errors/app-error";
import { ERROR_CODES } from "@/shared/errors/error-codes";
import { HTTP_STATUS } from "@/shared/errors/http-status";
import { buildPagination } from "@/shared/helpers/pagination";
import { sanitizeString } from "@/shared/helpers/sanitize";
import { toSlug } from "@/shared/helpers/slug";
import { createPlatformActivity } from "@/shared/services/activity-log.service";

function buildFilter({ search, status }: Omit<ListModuleCategoriesInput, "page" | "limit">) {
  const filters: SQL<unknown>[] = [];

  if (search) filters.push(ilike(moduleCategories.name, `%${search}%`));
  if (status) filters.push(eq(moduleCategories.status, status));

  if (!filters.length) return undefined;
  return and(...filters);
}

async function ensureModuleCategoryExists(moduleCategoryId: string) {
  const [existing] = await db
    .select({ id: moduleCategories.id })
    .from(moduleCategories)
    .where(eq(moduleCategories.id, moduleCategoryId))
    .limit(1);

  if (!existing) {
    throw new AppError({
      message: "Module category not found.",
      statusCode: HTTP_STATUS.NOT_FOUND,
      errorCode: ERROR_CODES.NOT_FOUND,
    });
  }
}

async function ensureModuleCategoryNameUnique(name: string, excludeModuleCategoryId?: string) {
  const slug = toSlug(name);
  const matches = await db
    .select({ id: moduleCategories.id })
    .from(moduleCategories)
    .where(eq(moduleCategories.slug, slug));

  const conflict = matches.find((item) => item.id !== excludeModuleCategoryId);

  if (conflict) {
    throw new AppError({
      message: "A module category with the same name already exists.",
      statusCode: HTTP_STATUS.CONFLICT,
      errorCode: ERROR_CODES.CONFLICT,
    });
  }
}

export async function listModuleCategories(input: ListModuleCategoriesInput) {
  const where = buildFilter(input);

  const [{ totalItems }] = await db
    .select({ totalItems: count() })
    .from(moduleCategories)
    .where(where);

  const pagination = buildPagination({
    page: input.page,
    limit: input.limit,
    totalItems,
  });

  const items = await db
    .select()
    .from(moduleCategories)
    .where(where)
    .orderBy(asc(moduleCategories.name))
    .limit(pagination.limit)
    .offset(pagination.offset);

  return { items, pagination };
}

export async function getModuleCategory(moduleCategoryId: string) {
  const [item] = await db
    .select()
    .from(moduleCategories)
    .where(eq(moduleCategories.id, moduleCategoryId))
    .limit(1);

  if (!item) {
    throw new AppError({
      message: "Module category not found.",
      statusCode: HTTP_STATUS.NOT_FOUND,
      errorCode: ERROR_CODES.NOT_FOUND,
    });
  }

  return item;
}

export async function createModuleCategory(input: CreateModuleCategoryInput) {
  const name = sanitizeString(input.name);
  await ensureModuleCategoryNameUnique(name);

  const [created] = await db
    .insert(moduleCategories)
    .values({
      name,
      slug: toSlug(name),
      description: input.description ? sanitizeString(input.description) : null,
      status: input.status,
      updatedAt: new Date(),
    })
    .returning({ id: moduleCategories.id });

  await createPlatformActivity({
    event: `Module category "${name}" created`,
    area: "Modules",
    action: "Created",
    status: "Success",
    companyNameSnapshot: "Platform",
  });

  return getModuleCategory(created.id);
}

export async function updateModuleCategory(
  moduleCategoryId: string,
  input: UpdateModuleCategoryInput,
) {
  await ensureModuleCategoryExists(moduleCategoryId);

  const updatePayload: Partial<typeof moduleCategories.$inferInsert> = {
    updatedAt: new Date(),
  };

  if (input.name) {
    const name = sanitizeString(input.name);
    await ensureModuleCategoryNameUnique(name, moduleCategoryId);
    updatePayload.name = name;
    updatePayload.slug = toSlug(name);
  }

  if (typeof input.description === "string") {
    updatePayload.description = sanitizeString(input.description);
  }

  if (input.status) {
    updatePayload.status = input.status;
  }

  await db
    .update(moduleCategories)
    .set(updatePayload)
    .where(eq(moduleCategories.id, moduleCategoryId));

  await createPlatformActivity({
    event: "Module category updated",
    area: "Modules",
    action: "Updated",
    status: "Success",
    companyNameSnapshot: "Platform",
  });

  return getModuleCategory(moduleCategoryId);
}

export async function deleteModuleCategory(moduleCategoryId: string) {
  const current = await getModuleCategory(moduleCategoryId);

  const [{ total }] = await db
    .select({ total: count() })
    .from(modules)
    .where(eq(modules.category, current.name));

  if (total > 0) {
    throw new AppError({
      message: `Cannot delete "${current.name}" while ${total} module(s) still use this category.`,
      statusCode: HTTP_STATUS.CONFLICT,
      errorCode: ERROR_CODES.CONFLICT,
    });
  }

  await db.delete(moduleCategories).where(eq(moduleCategories.id, moduleCategoryId));

  await createPlatformActivity({
    event: `Module category "${current.name}" deleted`,
    area: "Modules",
    action: "Deleted",
    status: "Warning",
    companyNameSnapshot: "Platform",
  });

  return { id: moduleCategoryId };
}
