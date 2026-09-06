import { Router } from "express";

import { requireAuth } from "@/middlewares/auth-placeholder.middleware";
import { requireRole } from "@/middlewares/role-placeholder.middleware";
import { validate } from "@/middlewares/validate.middleware";
import {
  getFinalMasterDataSampleTemplate,
  postMasterDataImportCommit,
  postMasterDataImportPreview,
} from "@/modules/master-data-imports/master-data-import.controller";
import { commitMasterDataImportBodySchema } from "@/modules/master-data-imports/master-data-import.validation";
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
  "/preview",
  requireAuth,
  requireRole(USER_ROLES.MASTER, USER_ROLES.ADMIN),
  singleSpreadsheetUploadMiddleware,
  ensureUploadedFile,
  postMasterDataImportPreview,
);

masterDataImportsRouter.post(
  "/commit",
  requireAuth,
  requireRole(USER_ROLES.MASTER, USER_ROLES.ADMIN),
  validate({ body: commitMasterDataImportBodySchema }),
  postMasterDataImportCommit,
);

export { masterDataImportsRouter };
