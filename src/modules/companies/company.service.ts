import {
  and,
  asc,
  count,
  eq,
  gte,
  ilike,
  or,
  sum,
  type SQL,
} from "drizzle-orm";

import { db } from "@/db";
import {
  admins,
  companies,
  companyAiUsageDaily,
  companyAccessSettings,
  companyModuleAccess,
  modules,
  moduleTypes,
} from "@/db/schema";
import type {
  CreateCompanyInput,
  ListCompaniesInput,
  UpdateCompanyAccessInput,
  UpdateCompanyInput,
} from "@/modules/companies/company.types";
import { AppError } from "@/shared/errors/app-error";
import { ERROR_CODES } from "@/shared/errors/error-codes";
import { HTTP_STATUS } from "@/shared/errors/http-status";
import { buildPagination } from "@/shared/helpers/pagination";
import { sanitizeString } from "@/shared/helpers/sanitize";
import { toSlug } from "@/shared/helpers/slug";
import { createPlatformActivity } from "@/shared/services/activity-log.service";
import { ensureCompanyAccessSettings } from "@/shared/services/platform-defaults.service";

function buildCompaniesFilter({
  search,
  status,
}: Omit<ListCompaniesInput, "page" | "limit">) {
  const filters: SQL<unknown>[] = [];

  if (search) {
    filters.push(
      or(
        ilike(companies.name, `%${search}%`),
        ilike(companies.ownerName, `%${search}%`),
        ilike(companies.ownerEmail, `%${search}%`),
      )!,
    );
  }

  if (status) {
    filters.push(eq(companies.status, status as typeof companies.$inferSelect.status));
  }

  if (!filters.length) {
    return undefined;
  }

  return and(...filters);
}

async function ensureCompanyExists(companyId: string) {
  const [company] = await db
    .select({
      id: companies.id,
      name: companies.name,
      logo: companies.logo,
      logoUrl: companies.logoUrl,
      logoKey: companies.logoKey,
      status: companies.status,
    })
    .from(companies)
    .where(eq(companies.id, companyId))
    .limit(1);

  if (!company) {
    throw new AppError({
      message: "Company not found.",
      statusCode: HTTP_STATUS.NOT_FOUND,
      errorCode: ERROR_CODES.NOT_FOUND,
    });
  }

  return company;
}

async function ensureCompanyNameUnique(companyName: string, excludeCompanyId?: string) {
  const slug = toSlug(companyName);

  const matches = await db
    .select({ id: companies.id })
    .from(companies)
    .where(eq(companies.slug, slug));

  const conflict = matches.find((item) => item.id !== excludeCompanyId);

  if (conflict) {
    throw new AppError({
      message: "A company with the same name already exists.",
      statusCode: HTTP_STATUS.CONFLICT,
      errorCode: ERROR_CODES.CONFLICT,
    });
  }
}

async function getCompanyUsageTotals(companyId: string) {
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const [totals] = await db
    .select({
      totalAiLogs: sum(companyAiUsageDaily.aiLogs),
      totalFailedRequests: sum(companyAiUsageDaily.failedRequests),
      totalEstimatedCostCents: sum(companyAiUsageDaily.estimatedCostCents),
    })
    .from(companyAiUsageDaily)
    .where(eq(companyAiUsageDaily.companyId, companyId));

  const [monthTotals] = await db
    .select({
      monthAiLogs: sum(companyAiUsageDaily.aiLogs),
    })
    .from(companyAiUsageDaily)
    .where(
      and(
        eq(companyAiUsageDaily.companyId, companyId),
        gte(companyAiUsageDaily.usageDate, startOfMonth),
      ),
    );

  return {
    totalAiLogs: Number(totals?.totalAiLogs ?? 0),
    totalFailedRequests: Number(totals?.totalFailedRequests ?? 0),
    totalEstimatedCostCents: Number(totals?.totalEstimatedCostCents ?? 0),
    monthAiLogs: Number(monthTotals?.monthAiLogs ?? 0),
  };
}

async function getCompanyEnabledModules(companyId: string) {
  const rows = await db
    .select({
      id: modules.id,
      slug: modules.slug,
      name: modules.name,
      icon: modules.icon,
      color: modules.color,
      status: modules.status,
      type: moduleTypes.name,
      category: modules.category,
      accessEnabled: companyModuleAccess.enabled,
    })
    .from(companyModuleAccess)
    .innerJoin(modules, eq(companyModuleAccess.moduleId, modules.id))
    .innerJoin(moduleTypes, eq(modules.moduleTypeId, moduleTypes.id))
    .where(
      and(
        eq(companyModuleAccess.companyId, companyId),
        eq(companyModuleAccess.enabled, true),
      ),
    )
    .orderBy(asc(modules.name));

  return rows;
}

async function syncCompanyModuleAccess(companyId: string, enabledModuleIds: string[]) {
  await db.delete(companyModuleAccess).where(eq(companyModuleAccess.companyId, companyId));

  if (!enabledModuleIds.length) {
    return;
  }

  await db.insert(companyModuleAccess).values(
    enabledModuleIds.map((moduleId) => ({
      companyId,
      moduleId,
      enabled: true,
      updatedAt: new Date(),
    })),
  );
}

export async function listCompanies(input: ListCompaniesInput) {
  const where = buildCompaniesFilter(input);

  const [{ totalItems }] = await db
    .select({ totalItems: count() })
    .from(companies)
    .where(where);

  const pagination = buildPagination({
    page: input.page,
    limit: input.limit,
    totalItems,
  });

  const items = await db
    .select({
      id: companies.id,
      name: companies.name,
      slug: companies.slug,
      logo: companies.logo,
      logoUrl: companies.logoUrl,
      logoKey: companies.logoKey,
      ownerName: companies.ownerName,
      ownerEmail: companies.ownerEmail,
      ownerPhone: companies.ownerPhone,
      businessType: companies.businessType,
      plan: companies.plan,
      startDate: companies.startDate,
      expiryDate: companies.expiryDate,
      status: companies.status,
      createdAt: companies.createdAt,
      updatedAt: companies.updatedAt,
    })
    .from(companies)
    .where(where)
    .orderBy(asc(companies.name))
    .limit(pagination.limit)
    .offset(pagination.offset);

  return {
    items,
    pagination,
  };
}

export async function listCompanyOptions() {
  return db
    .select({
      id: companies.id,
      name: companies.name,
      status: companies.status,
      plan: companies.plan,
      logo: companies.logo,
      logoUrl: companies.logoUrl,
      logoKey: companies.logoKey,
    })
    .from(companies)
    .orderBy(asc(companies.name));
}

export async function getCompanyById(companyId: string) {
  await ensureCompanyExists(companyId);

  const [company] = await db
    .select({
      id: companies.id,
      name: companies.name,
      slug: companies.slug,
      logo: companies.logo,
      logoUrl: companies.logoUrl,
      logoKey: companies.logoKey,
      ownerName: companies.ownerName,
      ownerEmail: companies.ownerEmail,
      ownerPhone: companies.ownerPhone,
      businessType: companies.businessType,
      plan: companies.plan,
      startDate: companies.startDate,
      expiryDate: companies.expiryDate,
      address: companies.address,
      notes: companies.notes,
      status: companies.status,
      createdAt: companies.createdAt,
      updatedAt: companies.updatedAt,
    })
    .from(companies)
    .where(eq(companies.id, companyId))
    .limit(1);

  const [{ totalAdmins }] = await db
    .select({ totalAdmins: count() })
    .from(admins)
    .where(eq(admins.companyId, companyId));

  const usageTotals = await getCompanyUsageTotals(companyId);
  const accessSettings = await ensureCompanyAccessSettings(companyId);
  const enabledModules = await getCompanyEnabledModules(companyId);

  return {
    ...company,
    stats: {
      totalAdmins,
      totalPlanners: 0,
      totalExecutionUsers: 0,
      totalLogs: usageTotals.totalAiLogs,
      aiUsageThisMonthLogs: usageTotals.monthAiLogs,
      storageUsedGb: 0,
      failedRequests: usageTotals.totalFailedRequests,
      estimatedCost: usageTotals.totalEstimatedCostCents / 100,
    },
    accessSummary: {
      userCreationLimit: accessSettings.userCreationLimit,
      aiUsageLimitMinutes: accessSettings.aiUsageLimitMinutes,
      storageLimitGb: accessSettings.storageLimitGb,
    },
    enabledModules,
  };
}

export async function createCompany(input: CreateCompanyInput) {
  const companyName = sanitizeString(input.companyName);
  await ensureCompanyNameUnique(companyName);

  const now = new Date();
  const [created] = await db
    .insert(companies)
    .values({
      name: companyName,
      slug: toSlug(companyName),
      logo: input.logo?.trim() || null,
      logoUrl: input.logoUrl ?? null,
      logoKey: input.logoKey ?? null,
      ownerName: sanitizeString(input.ownerName),
      ownerEmail: sanitizeString(input.ownerEmail).toLowerCase(),
      ownerPhone: sanitizeString(input.ownerPhone),
      businessType: sanitizeString(input.businessType),
      plan: sanitizeString(input.planType),
      startDate: input.startDate ?? null,
      expiryDate: input.expiryDate ?? null,
      address: input.address ? sanitizeString(input.address) : null,
      notes: input.notes ? sanitizeString(input.notes) : null,
      status: input.status as typeof companies.$inferInsert.status,
      createdAt: now,
      updatedAt: now,
    })
    .returning({ id: companies.id, name: companies.name });

  await ensureCompanyAccessSettings(created.id);
  await createPlatformActivity({
    event: `Company "${created.name}" created`,
    area: "Companies",
    action: "Created",
    status: "Success",
    companyId: created.id,
    companyNameSnapshot: created.name,
  });

  return getCompanyById(created.id);
}

export async function updateCompany(companyId: string, input: UpdateCompanyInput) {
  const existingCompany = await ensureCompanyExists(companyId);

  if (input.companyName) {
    await ensureCompanyNameUnique(sanitizeString(input.companyName), companyId);
  }

  const updatePayload: Partial<typeof companies.$inferInsert> = {
    updatedAt: new Date(),
  };

  if (input.companyName) {
    const companyName = sanitizeString(input.companyName);
    updatePayload.name = companyName;
    updatePayload.slug = toSlug(companyName);
  }

  if (typeof input.logo === "string") {
    updatePayload.logo = input.logo.trim() || null;
  }

  if (input.logoUrl !== undefined) {
    updatePayload.logoUrl = input.logoUrl;
  }

  if (input.logoKey !== undefined) {
    updatePayload.logoKey = input.logoKey;
  }

  if (input.ownerName) {
    updatePayload.ownerName = sanitizeString(input.ownerName);
  }

  if (input.ownerEmail) {
    updatePayload.ownerEmail = sanitizeString(input.ownerEmail).toLowerCase();
  }

  if (input.ownerPhone) {
    updatePayload.ownerPhone = sanitizeString(input.ownerPhone);
  }

  if (input.businessType) {
    updatePayload.businessType = sanitizeString(input.businessType);
  }

  if (input.address !== undefined) {
    updatePayload.address = input.address ? sanitizeString(input.address) : null;
  }

  if (input.planType) {
    updatePayload.plan = sanitizeString(input.planType);
  }

  if (input.status) {
    updatePayload.status = input.status as typeof companies.$inferInsert.status;
  }

  if (input.startDate !== undefined) {
    updatePayload.startDate = input.startDate ?? null;
  }

  if (input.expiryDate !== undefined) {
    updatePayload.expiryDate = input.expiryDate ?? null;
  }

  if (input.notes !== undefined) {
    updatePayload.notes = input.notes ? sanitizeString(input.notes) : null;
  }

  await db.update(companies).set(updatePayload).where(eq(companies.id, companyId));

  await createPlatformActivity({
    event: `Company "${updatePayload.name ?? existingCompany.name}" updated`,
    area: "Companies",
    action: "Updated",
    status: "Success",
    companyId,
    companyNameSnapshot: updatePayload.name ?? existingCompany.name,
  });

  return getCompanyById(companyId);
}

export async function deleteCompany(companyId: string) {
  const company = await ensureCompanyExists(companyId);

  await db.delete(companies).where(eq(companies.id, companyId));

  await createPlatformActivity({
    event: `Company "${company.name}" deleted`,
    area: "Companies",
    action: "Deleted",
    status: "Warning",
    companyNameSnapshot: company.name,
  });

  return { id: companyId };
}

export async function getCompanyAccessById(companyId: string) {
  await ensureCompanyExists(companyId);
  const settings = await ensureCompanyAccessSettings(companyId);
  const enabledModules = await getCompanyEnabledModules(companyId);

  return {
    ...settings,
    enabledModuleIds: enabledModules.map((module) => module.id),
    enabledModules,
  };
}

export async function updateCompanyAccessById(
  companyId: string,
  input: UpdateCompanyAccessInput,
) {
  const company = await ensureCompanyExists(companyId);
  await ensureCompanyAccessSettings(companyId);

  const { enabledModuleIds, ...settingsInput } = input;

  if (Object.keys(settingsInput).length) {
    await db
      .update(companyAccessSettings)
      .set({
        ...settingsInput,
        updatedAt: new Date(),
      })
      .where(eq(companyAccessSettings.companyId, companyId));
  }

  if (enabledModuleIds) {
    await syncCompanyModuleAccess(companyId, enabledModuleIds);
  }

  await createPlatformActivity({
    event: `Access controls updated for "${company.name}"`,
    area: "Companies",
    action: "Updated",
    status: "Success",
    companyId,
    companyNameSnapshot: company.name,
  });

  return getCompanyAccessById(companyId);
}

