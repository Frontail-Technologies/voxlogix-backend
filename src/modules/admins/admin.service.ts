import {
  and,
  asc,
  count,
  desc,
  eq,
  gte,
  ilike,
  lte,
  or,
  type SQL,
} from "drizzle-orm";

import { db } from "@/db";
import { adminLoginHistory, admins, companies } from "@/db/schema";
import type {
  AdminListRow,
  CreateAdminInput,
  ListAdminsInput,
  ResetPasswordInput,
  UpdateAdminInput,
} from "@/modules/admins/admin.types";
import { AppError } from "@/shared/errors/app-error";
import { ERROR_CODES } from "@/shared/errors/error-codes";
import { HTTP_STATUS } from "@/shared/errors/http-status";
import { buildPagination } from "@/shared/helpers/pagination";
import { sanitizeString } from "@/shared/helpers/sanitize";
import { hashPassword } from "@/shared/security/password";
import { createPlatformActivity } from "@/shared/services/activity-log.service";

function buildInitials(fullName: string) {
  const words = fullName
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2);

  return words.map((word) => word[0]?.toUpperCase() ?? "").join("");
}

function buildAdminsFilter({
  search,
  companyId,
  status,
  role,
  joinedFrom,
  joinedTo,
}: Omit<ListAdminsInput, "page" | "limit">) {
  const filters: SQL<unknown>[] = [];

  if (search) {
    filters.push(
      or(
        ilike(admins.fullName, `%${search}%`),
        ilike(admins.username, `%${search}%`),
        ilike(admins.email, `%${search}%`),
        ilike(companies.name, `%${search}%`),
      )!,
    );
  }

  if (companyId) {
    filters.push(eq(admins.companyId, companyId));
  }

  if (status) {
    filters.push(eq(admins.status, status as typeof admins.$inferSelect.status));
  }

  if (role) {
    filters.push(eq(admins.role, role as typeof admins.$inferSelect.role));
  }

  if (joinedFrom) {
    const from = new Date(joinedFrom);
    from.setHours(0, 0, 0, 0);
    filters.push(gte(admins.joinedOn, from));
  }

  if (joinedTo) {
    const to = new Date(joinedTo);
    to.setHours(23, 59, 59, 999);
    filters.push(lte(admins.joinedOn, to));
  }

  if (!filters.length) {
    return undefined;
  }

  return and(...filters);
}

async function ensureCompanyExists(companyId: string) {
  const [company] = await db
    .select({ id: companies.id })
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
}

async function ensureAdminExists(adminId: string) {
  const [admin] = await db
    .select({ id: admins.id })
    .from(admins)
    .where(eq(admins.id, adminId))
    .limit(1);

  if (!admin) {
    throw new AppError({
      message: "Admin not found.",
      statusCode: HTTP_STATUS.NOT_FOUND,
      errorCode: ERROR_CODES.NOT_FOUND,
    });
  }
}

async function ensureAdminUniqueness({
  email,
  username,
  excludeAdminId,
}: {
  email?: string;
  username?: string;
  excludeAdminId?: string;
}) {
  const checks = [email, username].filter(Boolean) as string[];

  if (!checks.length) {
    return;
  }

  const existing = await db
    .select({
      id: admins.id,
      email: admins.email,
      username: admins.username,
    })
    .from(admins)
    .where(
      or(
        ...(email ? [eq(admins.email, email)] : []),
        ...(username ? [eq(admins.username, username)] : []),
      )!,
    );

  const conflict = existing.find((item) => item.id !== excludeAdminId);

  if (conflict) {
    throw new AppError({
      message: "Admin with the same email or username already exists.",
      statusCode: HTTP_STATUS.CONFLICT,
      errorCode: ERROR_CODES.CONFLICT,
    });
  }
}

function mapAdminListItem(row: AdminListRow) {
  return {
    id: row.id,
    fullName: row.fullName,
    initials: row.initials,
    avatarUrl: row.avatarUrl,
    avatarKey: row.avatarKey,
    username: row.username,
    email: row.email,
    phone: row.phone,
    status: row.status,
    role: row.role,
    joinedOn: row.joinedOn,
    lastLoginAt: row.lastLoginAt,
    company: {
      id: row.companyId,
      name: row.companyName,
    },
  };
}

export async function listAdmins(input: ListAdminsInput) {
  const where = buildAdminsFilter(input);

  const [{ totalItems }] = await db
    .select({ totalItems: count() })
    .from(admins)
    .innerJoin(companies, eq(admins.companyId, companies.id))
    .where(where);

  const pagination = buildPagination({
    page: input.page,
    limit: input.limit,
    totalItems,
  });

  const rows = await db
    .select({
      id: admins.id,
      fullName: admins.fullName,
      initials: admins.initials,
      avatarUrl: admins.avatarUrl,
      avatarKey: admins.avatarKey,
      username: admins.username,
      email: admins.email,
      phone: admins.phone,
      status: admins.status,
      role: admins.role,
      joinedOn: admins.joinedOn,
      lastLoginAt: admins.lastLoginAt,
      companyId: companies.id,
      companyName: companies.name,
    })
    .from(admins)
    .innerJoin(companies, eq(admins.companyId, companies.id))
    .where(where)
    .orderBy(asc(admins.fullName))
    .limit(pagination.limit)
    .offset(pagination.offset);

  return {
    items: rows.map(mapAdminListItem),
    pagination,
  };
}

export async function getAdminById(adminId: string) {
  const [admin] = await db
    .select({
      id: admins.id,
      fullName: admins.fullName,
      initials: admins.initials,
      avatarUrl: admins.avatarUrl,
      avatarKey: admins.avatarKey,
      username: admins.username,
      email: admins.email,
      phone: admins.phone,
      role: admins.role,
      status: admins.status,
      requirePasswordReset: admins.requirePasswordReset,
      joinedOn: admins.joinedOn,
      lastLoginAt: admins.lastLoginAt,
      companyId: companies.id,
      companyName: companies.name,
    })
    .from(admins)
    .innerJoin(companies, eq(admins.companyId, companies.id))
    .where(eq(admins.id, adminId))
    .limit(1);

  if (!admin) {
    throw new AppError({
      message: "Admin not found.",
      statusCode: HTTP_STATUS.NOT_FOUND,
      errorCode: ERROR_CODES.NOT_FOUND,
    });
  }

  const loginHistory = await db
    .select({
      id: adminLoginHistory.id,
      loggedInAt: adminLoginHistory.loggedInAt,
      channel: adminLoginHistory.channel,
    })
    .from(adminLoginHistory)
    .where(eq(adminLoginHistory.adminId, adminId))
    .orderBy(desc(adminLoginHistory.loggedInAt))
    .limit(5);

  return {
    id: admin.id,
    fullName: admin.fullName,
    initials: admin.initials,
    avatarUrl: admin.avatarUrl,
    avatarKey: admin.avatarKey,
    username: admin.username,
    email: admin.email,
    phone: admin.phone,
    role: admin.role,
    status: admin.status,
    requirePasswordReset: admin.requirePasswordReset,
    joinedOn: admin.joinedOn,
    lastLoginAt: admin.lastLoginAt,
    company: {
      id: admin.companyId,
      name: admin.companyName,
    },
    activitySummary: {
      companies: 1,
      planners: 0,
      executionUsers: 0,
      logsCreated: 0,
    },
    recentLoginHistory: loginHistory,
  };
}

export async function createAdmin(input: CreateAdminInput) {
  await ensureCompanyExists(input.companyId);
  await ensureAdminUniqueness({
    email: input.email,
    username: input.username,
  });

  const now = new Date();
  const fullName = sanitizeString(input.fullName);
  const hashedPassword = await hashPassword(input.temporaryPassword);
  const initials = buildInitials(fullName);

  const [createdAdmin] = await db
    .insert(admins)
    .values({
      companyId: input.companyId,
      fullName,
      initials,
      username: sanitizeString(input.username).toLowerCase(),
      email: sanitizeString(input.email).toLowerCase(),
      phone: sanitizeString(input.phone),
      avatarUrl: input.avatarUrl ?? null,
      avatarKey: input.avatarKey ?? null,
      status: input.status as typeof admins.$inferInsert.status,
      role: input.role as typeof admins.$inferInsert.role,
      passwordHash: hashedPassword,
      requirePasswordReset: input.requirePasswordReset ?? true,
      updatedAt: now,
      joinedOn: now,
      createdAt: now,
    })
    .returning({ id: admins.id });

  await createPlatformActivity({
    event: `Admin "${fullName}" created`,
    area: "Admins",
    action: "Created",
    status: "Success",
    companyId: input.companyId,
  });

  return getAdminById(createdAdmin.id);
}

export async function updateAdmin(adminId: string, input: UpdateAdminInput) {
  await ensureAdminExists(adminId);

  const currentAdmin = await getAdminById(adminId);

  if (input.companyId) {
    await ensureCompanyExists(input.companyId);
  }

  await ensureAdminUniqueness({
    email: input.email ? sanitizeString(input.email).toLowerCase() : undefined,
    username: input.username
      ? sanitizeString(input.username).toLowerCase()
      : undefined,
    excludeAdminId: adminId,
  });

  const updatePayload: Partial<typeof admins.$inferInsert> = {
    updatedAt: new Date(),
  };

  if (input.fullName) {
    const fullName = sanitizeString(input.fullName);
    updatePayload.fullName = fullName;
    updatePayload.initials = buildInitials(fullName);
  }

  if (input.username) {
    updatePayload.username = sanitizeString(input.username).toLowerCase();
  }

  if (input.email) {
    updatePayload.email = sanitizeString(input.email).toLowerCase();
  }

  if (input.phone) {
    updatePayload.phone = sanitizeString(input.phone);
  }

  if (input.companyId) {
    updatePayload.companyId = input.companyId;
  }

  if (input.status) {
    updatePayload.status = input.status as typeof admins.$inferInsert.status;
  }

  if (input.role) {
    updatePayload.role = input.role as typeof admins.$inferInsert.role;
  }

  if (typeof input.requirePasswordReset === "boolean") {
    updatePayload.requirePasswordReset = input.requirePasswordReset;
  }

  if (input.avatarUrl !== undefined) {
    updatePayload.avatarUrl = input.avatarUrl;
  }

  if (input.avatarKey !== undefined) {
    updatePayload.avatarKey = input.avatarKey;
  }

  await db.update(admins).set(updatePayload).where(eq(admins.id, adminId));

  await createPlatformActivity({
    event: `Admin "${updatePayload.fullName ?? currentAdmin.fullName}" updated`,
    area: "Admins",
    action: "Updated",
    status: "Success",
    companyId: updatePayload.companyId ?? currentAdmin.company.id,
  });

  return getAdminById(adminId);
}

export async function resetAdminPassword(
  adminId: string,
  input: ResetPasswordInput,
) {
  await ensureAdminExists(adminId);
  const currentAdmin = await getAdminById(adminId);

  const hashedPassword = await hashPassword(input.temporaryPassword);

  await db
    .update(admins)
    .set({
      passwordHash: hashedPassword,
      requirePasswordReset: input.requireResetOnNextLogin,
      updatedAt: new Date(),
    })
    .where(eq(admins.id, adminId));

  await createPlatformActivity({
    event: `Password reset issued for "${currentAdmin.fullName}"`,
    area: "Admins",
    action: "Updated",
    status: "Success",
    companyId: currentAdmin.company.id,
  });

  return {
    adminId,
    requireResetOnNextLogin: input.requireResetOnNextLogin,
    sendNotificationEmail: input.sendNotificationEmail,
    message: "Temporary password updated successfully.",
  };
}

export async function deleteAdmin(adminId: string) {
  await ensureAdminExists(adminId);
  const currentAdmin = await getAdminById(adminId);

  await db.delete(admins).where(eq(admins.id, adminId));

  await createPlatformActivity({
    event: `Admin "${currentAdmin.fullName}" deleted`,
    area: "Admins",
    action: "Deleted",
    status: "Warning",
    companyId: currentAdmin.company.id,
  });

  return {
    id: adminId,
  };
}


