import { and, count, desc, eq, gte, inArray } from "drizzle-orm";

import { db } from "@/db";
import { admins, equipmentAssets, operationalLogs } from "@/db/schema";
import { getUsageCompanyDetail } from "@/modules/ai-usage/ai-usage.service";
import { USER_ROLES } from "@/shared/constants";

const DASHBOARD_STATUSES = [
  "DRAFT",
  "SUBMITTED",
  "PLANNED",
  "IN_PROGRESS",
  "COMPLETED",
  "NEEDS_CORRECTION",
];

const DASHBOARD_MODULES = [
  "EQUIPMENT_LOG",
  "SAFETY_LOG",
  "MEASUREMENT_POINT",
  "METER_COUNTER",
  "SHIFT",
  "SUGGESTION",
];

function startOfDay(date: Date) {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function formatTrendLabel(date: Date) {
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

async function countLogs(companyId: string, filters: Array<ReturnType<typeof eq> | ReturnType<typeof inArray>> = []) {
  const where = and(eq(operationalLogs.companyId, companyId), ...filters);
  const [{ total }] = await db.select({ total: count() }).from(operationalLogs).where(where);
  return total ?? 0;
}

async function countEquipment(companyId: string, filters: Array<ReturnType<typeof eq> | ReturnType<typeof inArray>> = []) {
  const where = and(eq(equipmentAssets.companyId, companyId), ...filters);
  const [{ total }] = await db.select({ total: count() }).from(equipmentAssets).where(where);
  return total ?? 0;
}

export async function getAdminDashboardSummary(companyId: string) {
  const [plannerRow] = await db
    .select({ total: count() })
    .from(admins)
    .where(and(eq(admins.companyId, companyId), eq(admins.role, USER_ROLES.PLANNER), eq(admins.status, "ACTIVE")));

  const [executionRow] = await db
    .select({ total: count() })
    .from(admins)
    .where(and(eq(admins.companyId, companyId), eq(admins.role, USER_ROLES.EXECUTION), eq(admins.status, "ACTIVE")));

  const usage = await getUsageCompanyDetail(companyId, {});
  const activePlanners = plannerRow?.total ?? 0;
  const activeExecutionUsers = executionRow?.total ?? 0;
  const activeUsers = activePlanners + activeExecutionUsers;
  const pendingStatuses = ["SUBMITTED", "PLANNED", "IN_PROGRESS", "NEEDS_CORRECTION"];
  const attentionStatuses = ["BREAKDOWN", "CRITICAL", "UNDER_MAINTENANCE"];

  const [
    totalEquipment,
    totalLogs,
    pendingLogs,
    completedLogs,
    criticalIssues,
    equipmentNeedingAttention,
    aiProcessedLogs,
  ] = await Promise.all([
    countEquipment(companyId),
    countLogs(companyId),
    countLogs(companyId, [inArray(operationalLogs.status, pendingStatuses)]),
    countLogs(companyId, [eq(operationalLogs.status, "COMPLETED")]),
    countLogs(companyId, [inArray(operationalLogs.severity, ["CRITICAL", "HIGH"])]),
    countEquipment(companyId, [inArray(equipmentAssets.status, attentionStatuses)]),
    countLogs(companyId, [eq(operationalLogs.aiProcessed, 1)]),
  ]);

  const [logsByStatusRows, logsByModuleRows, equipmentHealthRows] = await Promise.all([
    db
      .select({ status: operationalLogs.status, count: count() })
      .from(operationalLogs)
      .where(eq(operationalLogs.companyId, companyId))
      .groupBy(operationalLogs.status),
    db
      .select({ moduleType: operationalLogs.moduleType, count: count() })
      .from(operationalLogs)
      .where(eq(operationalLogs.companyId, companyId))
      .groupBy(operationalLogs.moduleType),
    db
      .select({ status: equipmentAssets.status, count: count() })
      .from(equipmentAssets)
      .where(eq(equipmentAssets.companyId, companyId))
      .groupBy(equipmentAssets.status),
  ]);

  const sevenDaysAgo = startOfDay(new Date());
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
  const trendRows = await db
    .select({ createdAt: operationalLogs.createdAt })
    .from(operationalLogs)
    .where(and(eq(operationalLogs.companyId, companyId), gte(operationalLogs.createdAt, sevenDaysAgo)));

  const trendDays = Array.from({ length: 7 }, (_, index) => {
    const date = startOfDay(new Date());
    date.setDate(date.getDate() - (6 - index));
    return date;
  });

  const logsTrend = trendDays.map((date) => {
    const next = new Date(date);
    next.setDate(next.getDate() + 1);
    return {
      label: formatTrendLabel(date),
      count: trendRows.filter((row) => row.createdAt >= date && row.createdAt < next).length,
    };
  });

  const recentLogs = await db
    .select({
      id: operationalLogs.id,
      logNumber: operationalLogs.logNumber,
      title: operationalLogs.title,
      issueCategory: operationalLogs.issueCategory,
      severity: operationalLogs.severity,
      status: operationalLogs.status,
      moduleType: operationalLogs.moduleType,
      createdAt: operationalLogs.createdAt,
      equipment: {
        id: equipmentAssets.id,
        equipmentCode: equipmentAssets.equipmentCode,
        name: equipmentAssets.name,
      },
      createdBy: {
        id: admins.id,
        fullName: admins.fullName,
      },
    })
    .from(operationalLogs)
    .leftJoin(equipmentAssets, eq(operationalLogs.equipmentId, equipmentAssets.id))
    .leftJoin(admins, eq(operationalLogs.createdById, admins.id))
    .where(eq(operationalLogs.companyId, companyId))
    .orderBy(desc(operationalLogs.createdAt))
    .limit(6);

  const criticalIssuesList = await db
    .select({
      id: operationalLogs.id,
      logNumber: operationalLogs.logNumber,
      title: operationalLogs.title,
      issueCategory: operationalLogs.issueCategory,
      severity: operationalLogs.severity,
      status: operationalLogs.status,
      createdAt: operationalLogs.createdAt,
      equipment: {
        id: equipmentAssets.id,
        equipmentCode: equipmentAssets.equipmentCode,
        name: equipmentAssets.name,
      },
    })
    .from(operationalLogs)
    .leftJoin(equipmentAssets, eq(operationalLogs.equipmentId, equipmentAssets.id))
    .where(and(eq(operationalLogs.companyId, companyId), inArray(operationalLogs.severity, ["CRITICAL", "HIGH"])))
    .orderBy(desc(operationalLogs.createdAt))
    .limit(5);

  return {
    stats: {
      totalEquipment,
      totalLogs,
      pendingLogs,
      completedLogs,
      criticalIssues,
      equipmentNeedingAttention,
      activeUsers,
      activePlanners,
      activeExecutionUsers,
      aiProcessedLogs,
    },
    pending: {
      reviewCount: await countLogs(companyId, [eq(operationalLogs.status, "SUBMITTED")]),
      correctionCount: await countLogs(companyId, [eq(operationalLogs.status, "NEEDS_CORRECTION")]),
      equipmentIssueCount: equipmentNeedingAttention,
    },
    equipmentHealth: equipmentHealthRows,
    logsByStatus: DASHBOARD_STATUSES.map((status) => ({
      status,
      count: logsByStatusRows.find((row) => row.status === status)?.count ?? 0,
    })),
    logsByModule: DASHBOARD_MODULES.map((moduleType) => ({
      moduleType,
      count: logsByModuleRows.find((row) => row.moduleType === moduleType)?.count ?? 0,
    })),
    logsTrend,
    recentLogs,
    criticalIssues: criticalIssuesList,
  };
}

export async function getExecutionDashboardSummary(companyId: string, userId: string) {
  const ownedFilter = [eq(operationalLogs.createdById, userId)];
  const today = startOfDay(new Date());

  const [todayLogs, draftLogs, submittedLogs, completedLogs, correctionLogs] = await Promise.all([
    countLogs(companyId, [...ownedFilter, gte(operationalLogs.createdAt, today)]),
    countLogs(companyId, [...ownedFilter, eq(operationalLogs.status, "DRAFT")]),
    countLogs(companyId, [...ownedFilter, inArray(operationalLogs.status, ["SUBMITTED", "PLANNED", "IN_PROGRESS"])]),
    countLogs(companyId, [...ownedFilter, eq(operationalLogs.status, "COMPLETED")]),
    countLogs(companyId, [...ownedFilter, eq(operationalLogs.status, "NEEDS_CORRECTION")]),
  ]);

  const recentLogs = await db
    .select({
      id: operationalLogs.id,
      logNumber: operationalLogs.logNumber,
      title: operationalLogs.title,
      issueCategory: operationalLogs.issueCategory,
      severity: operationalLogs.severity,
      status: operationalLogs.status,
      moduleType: operationalLogs.moduleType,
      createdAt: operationalLogs.createdAt,
      equipment: {
        id: equipmentAssets.id,
        equipmentCode: equipmentAssets.equipmentCode,
        name: equipmentAssets.name,
      },
    })
    .from(operationalLogs)
    .leftJoin(equipmentAssets, eq(operationalLogs.equipmentId, equipmentAssets.id))
    .where(and(eq(operationalLogs.companyId, companyId), eq(operationalLogs.createdById, userId)))
    .orderBy(desc(operationalLogs.createdAt))
    .limit(8);

  return {
    stats: {
      todayLogs,
      draftLogs,
      submittedLogs,
      completedLogs,
      correctionLogs,
    },
    recentLogs,
  };
}
