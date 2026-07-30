import { eq } from "drizzle-orm";

import { db } from "@/db";
import { aiSettings, companyAccessSettings, platformGeneralSettings } from "@/db/schema";

export async function ensureCompanyAccessSettings(companyId: string) {
  const [existing] = await db
    .select()
    .from(companyAccessSettings)
    .where(eq(companyAccessSettings.companyId, companyId))
    .limit(1);

  if (existing) {
    return existing;
  }

  const [created] = await db
    .insert(companyAccessSettings)
    .values({
      companyId,
      updatedAt: new Date(),
    })
    .returning();

  return created;
}

export async function ensureAiSettings() {
  const [existing] = await db.select().from(aiSettings).limit(1);

  if (existing) {
    return existing;
  }

  const [created] = await db
    .insert(aiSettings)
    .values({
      updatedAt: new Date(),
    })
    .returning();

  return created;
}

export async function ensurePlatformGeneralSettings() {
  const [existing] = await db.select().from(platformGeneralSettings).limit(1);

  if (existing) {
    return existing;
  }

  const [created] = await db
    .insert(platformGeneralSettings)
    .values({
      updatedAt: new Date(),
    })
    .returning();

  return created;
}