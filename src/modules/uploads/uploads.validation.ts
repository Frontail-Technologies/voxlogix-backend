import { z } from "zod";

import { env } from "@/config/env";

const assetContextValues = [
  "company-logo",
  "admin-avatar",
  "module-media",
  "generic-image",
  "log-attachment",
  "voice-recording",
  "equipment-manual",
] as const;

const IMAGE_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const AUDIO_MIME_TYPES = new Set([
  "audio/webm",
  "audio/ogg",
  "audio/mpeg",
  "audio/mp3",
  "audio/mp4",
  "audio/wav",
  "audio/x-wav",
]);
const DOCUMENT_MIME_TYPES = new Set([
  "application/pdf",
  "text/plain",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
]);
const contextMimeAllowlist: Record<
  (typeof assetContextValues)[number],
  Set<string>
> = {
  "company-logo": IMAGE_MIME_TYPES,
  "admin-avatar": IMAGE_MIME_TYPES,
  "module-media": IMAGE_MIME_TYPES,
  "generic-image": IMAGE_MIME_TYPES,
  "log-attachment": IMAGE_MIME_TYPES,
  "voice-recording": AUDIO_MIME_TYPES,
  "equipment-manual": DOCUMENT_MIME_TYPES,
};

const noTraversal = (value: string) =>
  !value.includes("..") && !value.startsWith("/");

export const uploadAssetBodySchema = z.object({
  folder: z
    .string()
    .trim()
    .max(120)
    .refine(noTraversal, "Folder must not contain path traversal sequences.")
    .optional(),
  fileName: z.string().trim().max(160).optional(),
  context: z.enum(assetContextValues).optional(),
});

export const createSignedUploadBodySchema = z
  .object({
    fileName: z.string().trim().min(1).max(160),
    contentType: z.string().trim().min(3).max(120),
    contentLength: z.coerce
      .number()
      .int()
      .positive()
      .max(
        env.STORAGE_MAX_FILE_SIZE_MB * 1024 * 1024,
        `File must be under ${env.STORAGE_MAX_FILE_SIZE_MB}MB.`,
      ),
    folder: z
      .string()
      .trim()
      .max(120)
      .refine(noTraversal, "Folder must not contain path traversal sequences.")
      .optional(),
    context: z.enum(assetContextValues),
  })
  .refine(
    (value) => contextMimeAllowlist[value.context].has(value.contentType),
    {
      message: "This content type is not allowed for the given upload context.",
      path: ["contentType"],
    },
  );

export const deleteUploadBodySchema = z.object({
  key: z.string().trim().min(1).max(500),
});

export const mediaUrlQuerySchema = z.object({
  key: z.string().trim().min(1).max(500),
  resourceType: z.enum(["image", "video", "raw"]).optional(),
});
