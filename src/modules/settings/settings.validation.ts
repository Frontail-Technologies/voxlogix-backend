import { z } from "zod";

const aiProviderValues = ["OpenAI", "Gemini", "Azure OpenAI", "Custom Provider"] as const;
const aiKeyStatusValues = ["Active", "Testing", "Disabled"] as const;

export const aiProviderConfigIdParamsSchema = z.object({
  configId: z.string().uuid(),
});

export const createAiProviderConfigBodySchema = z.object({
  provider: z.enum(aiProviderValues),
  defaultModel: z.string().trim().min(1).max(120),
  apiKeyName: z.string().trim().min(2).max(160),
  apiKey: z.string().trim().min(8).max(10000),
  keyStatus: z.enum(aiKeyStatusValues).default("Testing"),
  isDefault: z.boolean().optional().default(false),
  structuredExtractionEnabled: z.boolean().optional().default(true),
  usageCostAlertsEnabled: z.boolean().optional().default(true),
});

export const updateAiSettingsBodySchema = z
  .object({
    provider: z.enum(aiProviderValues).optional(),
    defaultModel: z.string().trim().min(1).max(120).optional(),
    apiKeyName: z.string().trim().min(2).max(160).optional(),
    apiKey: z.string().trim().min(8).max(10000).optional(),
    keyStatus: z.enum(aiKeyStatusValues).optional(),
    isDefault: z.boolean().optional(),
    structuredExtractionEnabled: z.boolean().optional(),
    usageCostAlertsEnabled: z.boolean().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one field is required",
  });

export const updateGeneralSettingsBodySchema = z
  .object({
    platformName: z.string().trim().min(2).max(160).optional(),
    logoUrl: z.string().trim().url().max(2000).nullable().optional(),
    logoKey: z.string().trim().max(2000).nullable().optional(),
    maintenanceModeEnabled: z.boolean().optional(),
    maintenanceMessage: z.string().trim().min(2).max(2000).optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one field is required",
  });