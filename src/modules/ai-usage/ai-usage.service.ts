import { and, asc, count, desc, eq, gte, lte, sql, sum } from "drizzle-orm";

import { db } from "@/db";
import { companies, companyAiUsageDaily, companyAiUsageDaily as usageTable } from "@/db/schema";
import type {
  UsageCompaniesInput,
  UsageOverviewInput,
} from "@/modules/ai-usage/ai-usage.types";
import { AppError } from "@/shared/errors/app-error";
import { ERROR_CODES } from "@/shared/errors/error-codes";
import { HTTP_STATUS } from "@/shared/errors/http-status";
import { buildPagination } from "@/shared/helpers/pagination";
import { ensureCompanyAccessSettings } from "@/shared/services/platform-defaults.service";

function getPeriodRange(input: Pick<UsageOverviewInput, "period" | "month" | "year"> = {}) {
  const now = new Date();
  const start = new Date(now);
  const end = new Date(now);
  const period = input.period ?? "THIS_MONTH";

  if (input.month && input.year) {
    start.setFullYear(input.year, input.month - 1, 1);
    start.setHours(0, 0, 0, 0);
    end.setFullYear(input.year, input.month, 0);
    end.setHours(23, 59, 59, 999);
    return { start, end };
  }

  if (period === "LAST_MONTH") {
    start.setMonth(now.getMonth() - 1, 1);
    start.setHours(0, 0, 0, 0);
    end.setMonth(now.getMonth(), 0);
    end.setHours(23, 59, 59, 999);
    return { start, end };
  }

  if (period === "THIS_QUARTER") {
    const quarterStartMonth = Math.floor(now.getMonth() / 3) * 3;
    start.setMonth(quarterStartMonth, 1);
    start.setHours(0, 0, 0, 0);
    return { start, end };
  }

  start.setDate(1);
  start.setHours(0, 0, 0, 0);
  return { start, end };
}

async function ensureCompanyExists(companyId: string) {
  const [company] = await db
    .select({
      id: companies.id,
      name: companies.name,
      logo: companies.logo,
      plan: companies.plan,
      businessType: companies.businessType,
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

function toMoney(cents: number) {
  return Number((cents / 100).toFixed(2));
}

export async function getUsageOverview(input: UsageOverviewInput) {
  const { start, end } = getPeriodRange(input);

  const [totals] = await db
    .select({
      totalAiLogs: sum(companyAiUsageDaily.aiLogs),
      totalFailedRequests: sum(companyAiUsageDaily.failedRequests),
      totalEstimatedCostCents: sum(companyAiUsageDaily.estimatedCostCents),
    })
    .from(companyAiUsageDaily)
    .where(
      and(
        gte(companyAiUsageDaily.usageDate, start),
        lte(companyAiUsageDaily.usageDate, end),
      ),
    );

  const totalAiLogs = Number(totals?.totalAiLogs ?? 0);
  const totalFailedRequests = Number(totals?.totalFailedRequests ?? 0);
  const totalEstimatedCostCents = Number(totals?.totalEstimatedCostCents ?? 0);
  const successfulLogs = Math.max(totalAiLogs - totalFailedRequests, 0);
  const successRate = totalAiLogs > 0 ? Number(((successfulLogs / totalAiLogs) * 100).toFixed(1)) : 0;

  const chartRows = await db
    .select({
      usageDate: companyAiUsageDaily.usageDate,
      aiLogs: sum(companyAiUsageDaily.aiLogs),
      estimatedCostCents: sum(companyAiUsageDaily.estimatedCostCents),
    })
    .from(companyAiUsageDaily)
    .where(
      and(
        gte(companyAiUsageDaily.usageDate, start),
        lte(companyAiUsageDaily.usageDate, end),
      ),
    )
    .groupBy(companyAiUsageDaily.usageDate)
    .orderBy(asc(companyAiUsageDaily.usageDate));

  const summaryRows = await db
    .select({
      companyId: companies.id,
      companyName: companies.name,
      logo: companies.logo,
      aiLogs: sum(companyAiUsageDaily.aiLogs),
    })
    .from(companyAiUsageDaily)
    .innerJoin(companies, eq(companyAiUsageDaily.companyId, companies.id))
    .where(
      and(
        gte(companyAiUsageDaily.usageDate, start),
        lte(companyAiUsageDaily.usageDate, end),
      ),
    )
    .groupBy(companies.id, companies.name, companies.logo)
    .orderBy(desc(sum(companyAiUsageDaily.aiLogs)))
    .limit(5);

  return {
    stats: {
      totalAiLogs,
      totalFailedRequests,
      successRate,
      estimatedCost: toMoney(totalEstimatedCostCents),
    },
    chart: chartRows.map((row) => ({
      date: row.usageDate,
      aiLogs: Number(row.aiLogs ?? 0),
      estimatedCost: toMoney(Number(row.estimatedCostCents ?? 0)),
    })),
    summary: summaryRows.map((row) => ({
      companyId: row.companyId,
      companyName: row.companyName,
      logo: row.logo,
      aiLogs: Number(row.aiLogs ?? 0),
      sharePercentage:
        totalAiLogs > 0
          ? Number(((Number(row.aiLogs ?? 0) / totalAiLogs) * 100).toFixed(1))
          : 0,
    })),
  };
}

export async function listUsageByCompany(input: UsageCompaniesInput) {
  const { start, end } = getPeriodRange(input);

  const companyWhere = input.companyId
    ? eq(companies.id, input.companyId)
    : undefined;

  const groupedRows = await db
    .select({
      companyId: companies.id,
      companyName: companies.name,
      logo: companies.logo,
      aiLogs: sum(usageTable.aiLogs),
      failedRequests: sum(usageTable.failedRequests),
      estimatedCostCents: sum(usageTable.estimatedCostCents),
      lastProcessedAt: sql<Date | null>`max(${usageTable.usageDate})`,
    })
    .from(usageTable)
    .innerJoin(companies, eq(usageTable.companyId, companies.id))
    .where(
      and(
        gte(usageTable.usageDate, start),
        lte(usageTable.usageDate, end),
        companyWhere,
      ),
    )
    .groupBy(companies.id, companies.name, companies.logo);

  const totalItems = groupedRows.length;
  const pagination = buildPagination({
    page: input.page,
    limit: input.limit,
    totalItems,
  });

  const totalAiLogs = groupedRows.reduce(
    (accumulator, row) => accumulator + Number(row.aiLogs ?? 0),
    0,
  );

  const items = groupedRows
    .sort((left, right) => Number(right.aiLogs ?? 0) - Number(left.aiLogs ?? 0))
    .slice(pagination.offset, pagination.offset + pagination.limit)
    .map((row) => {
      const aiLogs = Number(row.aiLogs ?? 0);
      const failedRequests = Number(row.failedRequests ?? 0);
      const successfulLogs = Math.max(aiLogs - failedRequests, 0);

      return {
        company: {
          id: row.companyId,
          name: row.companyName,
          logo: row.logo,
        },
        aiLogs,
        failedRequests,
        successRate: aiLogs > 0 ? Number(((successfulLogs / aiLogs) * 100).toFixed(1)) : 0,
        lastProcessedAt: row.lastProcessedAt,
        sharePercentage:
          totalAiLogs > 0
            ? Number(((aiLogs / totalAiLogs) * 100).toFixed(1))
            : 0,
        estimatedCost: toMoney(Number(row.estimatedCostCents ?? 0)),
      };
    });

  return {
    items,
    pagination,
  };
}

export async function getUsageCompanyDetail(companyId: string, input: UsageOverviewInput) {
  const company = await ensureCompanyExists(companyId);
  const { start, end } = getPeriodRange(input);

  const [totals] = await db
    .select({
      totalAiLogs: sum(companyAiUsageDaily.aiLogs),
      totalFailedRequests: sum(companyAiUsageDaily.failedRequests),
      totalEstimatedCostCents: sum(companyAiUsageDaily.estimatedCostCents),
      daysTracked: count(companyAiUsageDaily.id),
    })
    .from(companyAiUsageDaily)
    .where(
      and(
        eq(companyAiUsageDaily.companyId, companyId),
        gte(companyAiUsageDaily.usageDate, start),
        lte(companyAiUsageDaily.usageDate, end),
      ),
    );

  const breakdown = await db
    .select({
      date: companyAiUsageDaily.usageDate,
      aiLogs: companyAiUsageDaily.aiLogs,
      failedRequests: companyAiUsageDaily.failedRequests,
      estimatedCostCents: companyAiUsageDaily.estimatedCostCents,
    })
    .from(companyAiUsageDaily)
    .where(
      and(
        eq(companyAiUsageDaily.companyId, companyId),
        gte(companyAiUsageDaily.usageDate, start),
        lte(companyAiUsageDaily.usageDate, end),
      ),
    )
    .orderBy(asc(companyAiUsageDaily.usageDate));

  const access = await ensureCompanyAccessSettings(companyId);

  const totalAiLogs = Number(totals?.totalAiLogs ?? 0);
  const totalFailedRequests = Number(totals?.totalFailedRequests ?? 0);
  const totalEstimatedCostCents = Number(totals?.totalEstimatedCostCents ?? 0);

  return {
    company,
    limitSummary: {
      monthlyAiLogLimit: access.aiUsageLimitMinutes,
      aiLogsUsagePercent:
        access.aiUsageLimitMinutes > 0
          ? Number(((totalAiLogs / access.aiUsageLimitMinutes) * 100).toFixed(1))
          : 0,
      estimatedCostUsagePercent:
        access.aiUsageLimitMinutes > 0
          ? Number(((totalAiLogs / access.aiUsageLimitMinutes) * 100).toFixed(1))
          : 0,
    },
    stats: {
      totalAiLogs,
      failedRequests: totalFailedRequests,
      estimatedCost: toMoney(totalEstimatedCostCents),
      successRate:
        totalAiLogs > 0
          ? Number((((totalAiLogs - totalFailedRequests) / totalAiLogs) * 100).toFixed(1))
          : 0,
      trackedDays: Number(totals?.daysTracked ?? 0),
    },
    breakdown: breakdown.map((row) => ({
      date: row.date,
      aiLogs: row.aiLogs,
      failedRequests: row.failedRequests,
      estimatedCost: toMoney(row.estimatedCostCents),
    })),
  };
}
