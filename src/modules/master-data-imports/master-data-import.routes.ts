import { Router } from "express";

import { requireAuth } from "@/middlewares/auth-placeholder.middleware";
import { requireRole } from "@/middlewares/role-placeholder.middleware";
import { getFinalMasterDataSampleTemplate, postFinalMasterDataTemplate } from "@/modules/master-data-imports/master-data-import.controller";
import {
  ensureUploadedFile,
  singleSpreadsheetUploadMiddleware,
} from "@/modules/uploads/uploads.middleware";
import { USER_ROLES } from "@/shared/constants";

const masterDataImportsRouter = Router();

masterDataImportsRouter.get(
  "/sample-template",
  requireAuth,
  requireRole(USER_ROLES.MASTER, USER_ROLES.ADMIN),
  getFinalMasterDataSampleTemplate,
);

masterDataImportsRouter.post(
  "/final-template",
  requireAuth,
  requireRole(USER_ROLES.MASTER, USER_ROLES.ADMIN),
  singleSpreadsheetUploadMiddleware,
  ensureUploadedFile,
  postFinalMasterDataTemplate,
);

export { masterDataImportsRouter };
