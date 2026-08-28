import { Router } from "express";

import { parseMultipartPayload } from "@/middlewares/multipart-payload.middleware";
import { requireAuth } from "@/middlewares/auth-placeholder.middleware";
import { requireRole } from "@/middlewares/role-placeholder.middleware";
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
import { USER_ROLES } from "@/shared/constants";

const settingsRouter = Router();
// AI provider config and general platform settings are platform-wide (shared
// across every company), not company-scoped — only MASTER may view or change
// them. These were previously unauthenticated, which leaked live provider API
// keys and allowed anonymous writes/deletes; see security audit.
const platformSettingsOnly = requireRole(USER_ROLES.MASTER);

settingsRouter.get("/general", getGeneralSettings);
settingsRouter.get("/company-access", requireAuth, getCurrentCompanyAccessSettings);
settingsRouter.patch(
  "/general",
  requireAuth,
  platformSettingsOnly,
  singleImageUploadMiddleware,
  parseMultipartPayload,
  validate({ body: updateGeneralSettingsBodySchema }),
  patchGeneralSettings,
);
settingsRouter.get("/ai", requireAuth, platformSettingsOnly, getAiSettings);
settingsRouter.post("/ai", requireAuth, platformSettingsOnly, validate({ body: createAiProviderConfigBodySchema }), postAiSettings);
settingsRouter.patch(
  "/ai/:configId",
  requireAuth,
  platformSettingsOnly,
  validate({ params: aiProviderConfigIdParamsSchema, body: updateAiSettingsBodySchema }),
  patchAiSettings,
);
settingsRouter.patch(
  "/ai/:configId/default",
  requireAuth,
  platformSettingsOnly,
  validate({ params: aiProviderConfigIdParamsSchema }),
  patchAiSettingsDefault,
);
settingsRouter.delete(
  "/ai/:configId",
  requireAuth,
  platformSettingsOnly,
  validate({ params: aiProviderConfigIdParamsSchema }),
  removeAiSettings,
);

export { settingsRouter };
