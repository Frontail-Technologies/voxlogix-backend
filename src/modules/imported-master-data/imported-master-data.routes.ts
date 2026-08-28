import { Router } from "express";

import { requireAuth } from "@/middlewares/auth-placeholder.middleware";
import { requireRole } from "@/middlewares/role-placeholder.middleware";
import { validate } from "@/middlewares/validate.middleware";
import {
  getKaizenCategories,
  getMeasuringPointReadingHistory,
  getMeasuringPoints,
  getMeterCounterReadingHistory,
  getMeterCounters,
  getSafetyReporting,
  patchKaizenCategory,
  patchMeasuringPoint,
  patchMeterCounter,
  patchSafetyReporting,
  removeKaizenCategory,
  removeMeasuringPoint,
  removeMeterCounter,
  removeSafetyReporting,
} from "@/modules/imported-master-data/imported-master-data.controller";
import {
  importedMasterDataIdParamsSchema,
  listImportedMasterDataQuerySchema,
  updateKaizenCategoryBodySchema,
  updateMeasuringPointBodySchema,
  updateMeterCounterBodySchema,
  updateSafetyReportingBodySchema,
} from "@/modules/imported-master-data/imported-master-data.validation";
import { USER_ROLES } from "@/shared/constants";
import { paginationQuerySchema } from "@/shared/validators/pagination.validation";

const importedMasterDataRouter = Router();
const readRoles = [USER_ROLES.ADMIN, USER_ROLES.MASTER, USER_ROLES.PLANNER, USER_ROLES.EXECUTION];
const writeRoles = [USER_ROLES.ADMIN, USER_ROLES.MASTER];

importedMasterDataRouter.use(requireAuth);

importedMasterDataRouter.get("/safety-reporting", requireRole(...readRoles), validate({ query: listImportedMasterDataQuerySchema }), getSafetyReporting);
importedMasterDataRouter.patch("/safety-reporting/:id", requireRole(...writeRoles), validate({ params: importedMasterDataIdParamsSchema, body: updateSafetyReportingBodySchema }), patchSafetyReporting);
importedMasterDataRouter.delete("/safety-reporting/:id", requireRole(...writeRoles), validate({ params: importedMasterDataIdParamsSchema }), removeSafetyReporting);

importedMasterDataRouter.get("/measuring-points", requireRole(...readRoles), validate({ query: listImportedMasterDataQuerySchema }), getMeasuringPoints);
importedMasterDataRouter.get("/measuring-points/:id/readings", requireRole(...readRoles), validate({ params: importedMasterDataIdParamsSchema, query: paginationQuerySchema }), getMeasuringPointReadingHistory);
importedMasterDataRouter.patch("/measuring-points/:id", requireRole(...writeRoles), validate({ params: importedMasterDataIdParamsSchema, body: updateMeasuringPointBodySchema }), patchMeasuringPoint);
importedMasterDataRouter.delete("/measuring-points/:id", requireRole(...writeRoles), validate({ params: importedMasterDataIdParamsSchema }), removeMeasuringPoint);

importedMasterDataRouter.get("/meter-counters", requireRole(...readRoles), validate({ query: listImportedMasterDataQuerySchema }), getMeterCounters);
importedMasterDataRouter.get("/meter-counters/:id/readings", requireRole(...readRoles), validate({ params: importedMasterDataIdParamsSchema, query: paginationQuerySchema }), getMeterCounterReadingHistory);
importedMasterDataRouter.patch("/meter-counters/:id", requireRole(...writeRoles), validate({ params: importedMasterDataIdParamsSchema, body: updateMeterCounterBodySchema }), patchMeterCounter);
importedMasterDataRouter.delete("/meter-counters/:id", requireRole(...writeRoles), validate({ params: importedMasterDataIdParamsSchema }), removeMeterCounter);

importedMasterDataRouter.get("/kaizen", requireRole(...readRoles), validate({ query: listImportedMasterDataQuerySchema }), getKaizenCategories);
importedMasterDataRouter.patch("/kaizen/:id", requireRole(...writeRoles), validate({ params: importedMasterDataIdParamsSchema, body: updateKaizenCategoryBodySchema }), patchKaizenCategory);
importedMasterDataRouter.delete("/kaizen/:id", requireRole(...writeRoles), validate({ params: importedMasterDataIdParamsSchema }), removeKaizenCategory);

export { importedMasterDataRouter };
