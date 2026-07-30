import { Router } from "express";

import { validate } from "@/middlewares/validate.middleware";
import {
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
  uploadAssetBodySchema,
} from "@/modules/uploads/uploads.validation";

const uploadsRouter = Router();

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
