import { Router } from "express";

import { requireAuth } from "@/middlewares/auth-placeholder.middleware";
import { validate } from "@/middlewares/validate.middleware";
import {
  getMediaSignedUrl,
  postAudioUpload,
  postImageUpload,
  postSignedUpload,
  removeUploadAsset,
} from "@/modules/uploads/uploads.controller";
import {
  ensureUploadedFile,
  singleAudioUploadMiddleware,
  singleImageUploadMiddleware,
} from "@/modules/uploads/uploads.middleware";
import {
  createSignedUploadBodySchema,
  deleteUploadBodySchema,
  mediaUrlQuerySchema,
  uploadAssetBodySchema,
} from "@/modules/uploads/uploads.validation";

const uploadsRouter = Router();
// Uploads are used by every authenticated role (field technicians attach
// photos/voice to logs, admins upload manuals/avatars/logos) — gate on auth
// only, not a specific role. Was previously fully unauthenticated, allowing
// anonymous storage abuse; see security audit. Delete and the signed-URL
// endpoint both resolve the asset's actual owning record and check company
// (or platform/MASTER) ownership before acting — see
// uploads.service.ts#authorizeAssetAccess.
uploadsRouter.use(requireAuth);

uploadsRouter.get(
  "/media-url",
  validate({ query: mediaUrlQuerySchema }),
  getMediaSignedUrl,
);

uploadsRouter.post(
  "/images",
  singleImageUploadMiddleware,
  ensureUploadedFile,
  validate({ body: uploadAssetBodySchema }),
  postImageUpload,
);

uploadsRouter.post(
  "/audio",
  singleAudioUploadMiddleware,
  ensureUploadedFile,
  validate({ body: uploadAssetBodySchema }),
  postAudioUpload,
);

uploadsRouter.post(
  "/signed",
  validate({ body: createSignedUploadBodySchema }),
  postSignedUpload,
);

uploadsRouter.delete(
  "/assets",
  validate({ body: deleteUploadBodySchema }),
  removeUploadAsset,
);

export { uploadsRouter };
