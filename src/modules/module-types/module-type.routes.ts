import { Router } from "express";

import { requireAuth } from "@/middlewares/auth-placeholder.middleware";
import { requireRole } from "@/middlewares/role-placeholder.middleware";
import { validate } from "@/middlewares/validate.middleware";

import {
  getModuleTypeDetail,
  getModuleTypes,
  patchModuleType,
  postModuleType,
  removeModuleType,
} from "./module-type.controller";
import {
  listModuleTypesQuerySchema,
  moduleTypeBodySchema,
  moduleTypeIdParamsSchema,
  updateModuleTypeBodySchema,
} from "./module-type.validation";
import { USER_ROLES } from "@/shared/constants";

const moduleTypesRouter = Router();
// Same pattern as module-categories.routes.ts: viewable by any authenticated
// role, mutable by MASTER only. Was previously fully unauthenticated.
const viewRoles = [USER_ROLES.ADMIN, USER_ROLES.MASTER, USER_ROLES.PLANNER, USER_ROLES.EXECUTION];
moduleTypesRouter.use(requireAuth);

moduleTypesRouter.get("/", requireRole(...viewRoles), validate({ query: listModuleTypesQuerySchema }), getModuleTypes);
moduleTypesRouter.get("/:moduleTypeId", requireRole(...viewRoles), validate({ params: moduleTypeIdParamsSchema }), getModuleTypeDetail);
moduleTypesRouter.post("/", requireRole(USER_ROLES.MASTER), validate({ body: moduleTypeBodySchema }), postModuleType);
moduleTypesRouter.patch(
  "/:moduleTypeId",
  requireRole(USER_ROLES.MASTER),
  validate({ params: moduleTypeIdParamsSchema, body: updateModuleTypeBodySchema }),
  patchModuleType,
);
moduleTypesRouter.delete("/:moduleTypeId", requireRole(USER_ROLES.MASTER), validate({ params: moduleTypeIdParamsSchema }), removeModuleType);

export { moduleTypesRouter };
