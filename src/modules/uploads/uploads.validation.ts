import { z } from "zod";

const assetContextValues = [
  "company-logo",
  "admin-avatar",
  "module-media",
  "generic-image",
  "log-attachment",
  "voice-recording",
  "equipment-manual",
] as const;

export const uploadAssetBodySchema = z.object({
  folder: z.string().trim().max(120).optional(),
  fileName: z.string().trim().max(160).optional(),
  context: z.enum(assetContextValues).optional(),
});

export const createSignedUploadBodySchema = z.object({
  fileName: z.string().trim().min(1).max(160),
  contentType: z.string().trim().min(3).max(120),
  folder: z.string().trim().max(120).optional(),
  context: z.enum(assetContextValues).optional(),
});

export const deleteUploadBodySchema = z.object({
  key: z.string().trim().min(1).max(500),
});
