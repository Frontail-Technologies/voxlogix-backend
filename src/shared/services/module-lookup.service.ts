import { and, eq, or, sql } from "drizzle-orm";

import { db } from "@/db";
import { modules, moduleTypes } from "@/db/schema";

export type CanonicalModule = { id: string | null; name: string; type: string };

// Shared by measuring-point.service.ts and meter-counter.service.ts to resolve the live
// module record their alert logs should be stamped with. Matches an active module whose
// name / canonical type / slug contains any of the given keywords, and always resolves
// `.type` to the CANONICAL type key (moduleTypes.name, e.g. "MEASUREMENT_POINT") rather
// than the human-readable module name — the same value every other log-creation path and
// the client's module filter both compare `operationalLogs.moduleType` against. A caller
// that instead used `.name` here was the root cause of a real bug: out-of-limit alerts
// were stamped "Measurement Point" while everything else compared against
// "MEASUREMENT_POINT", so alerts silently vanished the moment the module filter was
// applied (visible under "All Modules", invisible under "Measuring Point"). Centralizing
// the resolution — and the type-over-name priority — here means a caller can no longer get
// this backwards; it just uses `.type` and gets the right value.
export async function resolveCanonicalModule(
  tx: Pick<typeof db, "select">,
  keywords: string[],
  fallback: CanonicalModule,
): Promise<CanonicalModule> {
  const keywordConditions = keywords.map(
    (keyword) => sql<boolean>`(
      lower(${modules.name}) like ${`%${keyword}%`}
      or lower(${moduleTypes.name}) like ${`%${keyword}%`}
      or lower(${modules.slug}) like ${`%${keyword}%`}
    )`,
  );

  const [module] = await tx
    .select({ id: modules.id, name: modules.name, type: moduleTypes.name })
    .from(modules)
    .leftJoin(moduleTypes, eq(modules.moduleTypeId, moduleTypes.id))
    .where(and(eq(modules.status, "ACTIVE"), or(...keywordConditions)))
    .limit(1);

  if (!module) return fallback;

  return { id: module.id, name: module.name, type: module.type || module.name || fallback.type };
}
