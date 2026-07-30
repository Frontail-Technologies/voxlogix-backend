import type { z } from "zod";

import type {
  createSignedUploadBodySchema,
  deleteUploadBodySchema,
  uploadAssetBodySchema,
} from "./uploads.validation";

export type UploadAssetBody = z.infer<typeof uploadAssetBodySchema>;
export type CreateSignedUploadBody = z.infer<typeof createSignedUploadBodySchema>;
export type DeleteUploadBody = z.infer<typeof deleteUploadBodySchema>;
