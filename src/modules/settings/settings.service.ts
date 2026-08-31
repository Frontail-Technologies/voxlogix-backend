import { desc, eq, ne } from "drizzle-orm";

import { db } from "@/db";
import { aiSettings, platformGeneralSettings } from "@/db/schema";
import type {
  CreateAiProviderConfigInput,
  UpdateAiSettingsInput,
  UpdateGeneralSettingsInput,
} from "@/modules/settings/settings.types";
import { AppError } from "@/shared/errors/app-error";
import { ERROR_CODES } from "@/shared/errors/error-codes";
import { HTTP_STATUS } from "@/shared/errors/http-status";
import { createPlatformActivity } from "@/shared/services/activity-log.service";
import { ensurePlatformGeneralSettings } from "@/shared/services/platform-defaults.service";

async function ensureAiProviderConfig(configId: string) {
  const [existing] = await db
    .select({ id: aiSettings.id })
    .from(aiSettings)
    .where(eq(aiSettings.id, configId))
    .limit(1);

  if (!existing) {
    throw new AppError({
      message: "AI provider config not found.",
      statusCode: HTTP_STATUS.NOT_FOUND,
      errorCode: ERROR_CODES.NOT_FOUND,
    });
  }
}

function maskApiKey(apiKey: string) {
  if (apiKey.length <= 8) return "*".repeat(8);
  return `${apiKey.slice(0, 4)}${"*".repeat(10)}${apiKey.slice(-4)}`;
}
function maskConfig<T extends { apiKey: string }>(config: T): T {
  return { ...config, apiKey: maskApiKey(config.apiKey) };
}

export async function listAiProviderConfigs() {
  const rows = await db
    .select()
    .from(aiSettings)
    .orderBy(desc(aiSettings.updatedAt));
  return rows.map(maskConfig);
}

export async function createAiProviderConfig(
  input: CreateAiProviderConfigInput,
) {
  const created = await db.transaction(async (tx) => {
    if (input.isDefault) {
      await tx
        .update(aiSettings)
        .set({ isDefault: false, updatedAt: new Date() });
    }

    const [row] = await tx
      .insert(aiSettings)
      .values({
        ...input,
        updatedAt: new Date(),
      })
      .returning();

    return row;
  });

  await createPlatformActivity({
    event: `AI provider config "${input.apiKeyName}" created`,
    area: "Settings",
    action: "Created",
    status: "Success",
  });

  return maskConfig(created);
}

export async function updateAiProviderConfig(
  configId: string,
  input: UpdateAiSettingsInput,
) {
  await ensureAiProviderConfig(configId);

  await db.transaction(async (tx) => {
    if (input.isDefault) {
      await tx
        .update(aiSettings)
        .set({ isDefault: false, updatedAt: new Date() })
        .where(ne(aiSettings.id, configId));
    }

    await tx
      .update(aiSettings)
      .set({
        ...input,
        updatedAt: new Date(),
      })
      .where(eq(aiSettings.id, configId));
  });

  await createPlatformActivity({
    event: "AI provider config updated",
    area: "Settings",
    action: "Updated",
    status: "Success",
  });

  const [updated] = await db
    .select()
    .from(aiSettings)
    .where(eq(aiSettings.id, configId))
    .limit(1);
  return maskConfig(updated);
}

export async function setAiProviderConfigDefault(configId: string) {
  await ensureAiProviderConfig(configId);

  await db.transaction(async (tx) => {
    await tx
      .update(aiSettings)
      .set({ isDefault: false, updatedAt: new Date() })
      .where(ne(aiSettings.id, configId));
    await tx
      .update(aiSettings)
      .set({ isDefault: true, updatedAt: new Date() })
      .where(eq(aiSettings.id, configId));
  });

  await createPlatformActivity({
    event: "AI provider default changed",
    area: "Settings",
    action: "Updated",
    status: "Success",
  });

  const [updated] = await db
    .select()
    .from(aiSettings)
    .where(eq(aiSettings.id, configId))
    .limit(1);
  return maskConfig(updated);
}

export async function deleteAiProviderConfig(configId: string) {
  await ensureAiProviderConfig(configId);
  await db.delete(aiSettings).where(eq(aiSettings.id, configId));

  await createPlatformActivity({
    event: "AI provider config deleted",
    area: "Settings",
    action: "Deleted",
    status: "Warning",
  });

  return { id: configId };
}

export async function getGeneralSettingsDetail() {
  return ensurePlatformGeneralSettings();
}

export async function updateGeneralSettingsDetail(
  input: UpdateGeneralSettingsInput,
) {
  const settings = await ensurePlatformGeneralSettings();

  await db
    .update(platformGeneralSettings)
    .set({
      ...input,
      updatedAt: new Date(),
    })
    .where(eq(platformGeneralSettings.id, settings.id));

  await createPlatformActivity({
    event: "General settings updated",
    area: "Settings",
    action: "Updated",
    status: "Success",
  });

  return getGeneralSettingsDetail();
}
