import { and, desc, eq, not } from "drizzle-orm";

import { db } from "@/db";
import { logTimelineEvents, operationalLogs } from "@/db/schema";

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;

export async function listNotifications(companyId: string, userId: string, limit?: number) {
  const cappedLimit = Math.min(Math.max(limit ?? DEFAULT_LIMIT, 1), MAX_LIMIT);

  const rows = await db
    .select({
      id: logTimelineEvents.id,
      logId: logTimelineEvents.logId,
      event: logTimelineEvents.event,
      status: logTimelineEvents.status,
      notes: logTimelineEvents.notes,
      actorNameSnapshot: logTimelineEvents.actorNameSnapshot,
      createdAt: logTimelineEvents.createdAt,
      logTitle: operationalLogs.title,
      logNumber: operationalLogs.logNumber,
    })
    .from(logTimelineEvents)
    .innerJoin(operationalLogs, eq(logTimelineEvents.logId, operationalLogs.id))
    .where(
      and(
        eq(operationalLogs.createdById, userId),
        eq(operationalLogs.companyId, companyId),
        not(
          and(
            eq(logTimelineEvents.event, "Log created"),
            eq(logTimelineEvents.actorId, operationalLogs.createdById),
          )!,
        ),
      ),
    )
    .orderBy(desc(logTimelineEvents.createdAt))
    .limit(cappedLimit);

  return rows;
}
