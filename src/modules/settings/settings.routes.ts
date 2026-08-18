import { Router } from "express";

import { parseMultipartPayload } from "@/middlewares/multipart-payload.middleware";
import { requireAuth } from "@/middlewares/auth-placeholder.middleware";
import { validate } from "@/middlewares/validate.middleware";
import { singleImageUploadMiddleware } from "@/modules/uploads/uploads.middleware";
import {
  getAiSettings,
  getCurrentCompanyAccessSettings,
  getGeneralSettings,
  patchAiSettings,
  patchAiSettingsDefault,
  patchGeneralSettings,
  postAiSettings,
  removeAiSettings,
} from "@/modules/settings/settings.controller";
import {
  aiProviderConfigIdParamsSchema,
  createAiProviderConfigBodySchema,
  updateAiSettingsBodySchema,
  updateGeneralSettingsBodySchema,
} from "@/modules/settings/settings.validation";

const settingsRouter = Router();

settingsRouter.get("/general", getGeneralSettings);
settingsRouter.get("/company-access", requireAuth, getCurrentCompanyAccessSettings);
settingsRouter.patch(
  "/general",
  singleImageUploadMiddleware,
  parseMultipartPayload,
  validate({ body: updateGeneralSettingsBodySchema }),
  patchGeneralSettings,
);
settingsRouter.get("/ai", getAiSettings);
settingsRouter.post("/ai", validate({ body: createAiProviderConfigBodySchema }), postAiSettings);
settingsRouter.patch(
  "/ai/:configId",
  validate({ params: aiProviderConfigIdParamsSchema, body: updateAiSettingsBodySchema }),
  patchAiSettings,
);
settingsRouter.patch(
  "/ai/:configId/default",
  validate({ params: aiProviderConfigIdParamsSchema }),
  patchAiSettingsDefault,
);
settingsRouter.delete(
  "/ai/:configId",
  validate({ params: aiProviderConfigIdParamsSchema }),
  removeAiSettings,
);

export { settingsRouter };
