import { Router } from "express";

import { requireAuth } from "@/middlewares/auth-placeholder.middleware";
import { requireRole } from "@/middlewares/role-placeholder.middleware";
import { validate } from "@/middlewares/validate.middleware";
import { getKaizenCategories, getMeasuringPoints, getMeterCounters, getSafetyReporting } from "@/modules/imported-master-data/imported-master-data.controller";
import { listImportedMasterDataQuerySchema } from "@/modules/imported-master-data/imported-master-data.validation";
import { USER_ROLES } from "@/shared/constants";

const importedMasterDataRouter = Router();
const roles = [USER_ROLES.ADMIN, USER_ROLES.MASTER, USER_ROLES.PLANNER, USER_ROLES.EXECUTION];

importedMasterDataRouter.use(requireAuth, requireRole(...roles));
importedMasterDataRouter.get("/safety-reporting", validate({ query: listImportedMasterDataQuerySchema }), getSafetyReporting);
importedMasterDataRouter.get("/measuring-points", validate({ query: listImportedMasterDataQuerySchema }), getMeasuringPoints);
importedMasterDataRouter.get("/meter-counters", validate({ query: listImportedMasterDataQuerySchema }), getMeterCounters);
importedMasterDataRouter.get("/kaizen", validate({ query: listImportedMasterDataQuerySchema }), getKaizenCategories);

export { importedMasterDataRouter };
