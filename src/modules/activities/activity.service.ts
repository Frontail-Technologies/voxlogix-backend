import { and, count, desc, eq, ilike, or, type SQL } from "drizzle-orm";

import { db } from "@/db";
import { companies, platformActivities } from "@/db/schema";
import type { ListActivitiesInput } from "@/modules/activities/activity.types";
import { buildPagination } from "@/shared/helpers/pagination";

function buildActivitiesFilter({
  search,
  area,
  action,
  status,
}: Omit<ListActivitiesInput, "page" | "limit">) {
  const filters: SQL<unknown>[] = [];

  if (search) {
    filters.push(
      or(
        ilike(platformActivities.event, `%${search}%`),
        ilike(platformActivities.userDisplayName, `%${search}%`),
        ilike(platformActivities.companyNameSnapshot, `%${search}%`),
      )!,
    );
  }

  if (area) {
    filters.push(eq(platformActivities.area, area));
  }

  if (action) {
    filters.push(eq(platformActivities.action, action));
  }

  if (status) {
    filters.push(eq(platformActivities.status, status));
  }

  if (!filters.length) {
    return undefined;
  }

  return and(...filters);
}

export async function listActivities(input: ListActivitiesInput) {
  const where = buildActivitiesFilter(input);

  const [{ totalItems }] = await db
    .select({ totalItems: count() })
    .from(platformActivities)
    .leftJoin(companies, eq(platformActivities.companyId, companies.id))
    .where(where);

  const pagination = buildPagination({
    page: input.page,
    limit: input.limit,
    totalItems,
  });

  const items = await db
    .select({
      id: platformActivities.id,
      event: platformActivities.event,
      area: platformActivities.area,
      companyId: companies.id,
      companyName: companies.name,
      companyNameSnapshot: platformActivities.companyNameSnapshot,
      userDisplayName: platformActivities.userDisplayName,
      action: platformActivities.action,
      status: platformActivities.status,
      occurredAt: platformActivities.occurredAt,
    })
    .from(platformActivities)
    .leftJoin(companies, eq(platformActivities.companyId, companies.id))
    .where(where)
    .orderBy(desc(platformActivities.occurredAt))
    .limit(pagination.limit)
    .offset(pagination.offset);

  return {
    items: items.map((item) => ({
      id: item.id,
      event: item.event,
      area: item.area,
      company: {
        id: item.companyId,
        name: item.companyName ?? item.companyNameSnapshot ?? "Platform",
      },
      user: item.userDisplayName,
      action: item.action,
      status: item.status,
      occurredAt: item.occurredAt,
    })),
    pagination,
  };
}
