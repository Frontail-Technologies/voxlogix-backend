import { Router } from "express";

import { requireAuth } from "@/middlewares/auth-placeholder.middleware";
import { requireRole } from "@/middlewares/role-placeholder.middleware";
import { validate } from "@/middlewares/validate.middleware";

import {
  getModuleCategories,
  getModuleCategoryDetail,
  patchModuleCategory,
  postModuleCategory,
  removeModuleCategory,
} from "@/modules/module-categories/module-category.controller";
import {
  listModuleCategoriesQuerySchema,
  moduleCategoryBodySchema,
  moduleCategoryIdParamsSchema,
  updateModuleCategoryBodySchema,
} from "@/modules/module-categories/module-category.validation";
import { USER_ROLES } from "@/shared/constants";

const moduleCategoriesRouter = Router();
// Platform-wide taxonomy feeding module.routes.ts — mirrors that router's
// pattern: viewable by any authenticated role, mutable by MASTER only. Was
// previously fully unauthenticated; see security audit.
const viewRoles = [USER_ROLES.ADMIN, USER_ROLES.MASTER, USER_ROLES.PLANNER, USER_ROLES.EXECUTION];
moduleCategoriesRouter.use(requireAuth);

moduleCategoriesRouter.get("/", requireRole(...viewRoles), validate({ query: listModuleCategoriesQuerySchema }), getModuleCategories);
moduleCategoriesRouter.get(
  "/:moduleCategoryId",
  requireRole(...viewRoles),
  validate({ params: moduleCategoryIdParamsSchema }),
  getModuleCategoryDetail,
);
moduleCategoriesRouter.post("/", requireRole(USER_ROLES.MASTER), validate({ body: moduleCategoryBodySchema }), postModuleCategory);
moduleCategoriesRouter.patch(
  "/:moduleCategoryId",
  requireRole(USER_ROLES.MASTER),
  validate({ params: moduleCategoryIdParamsSchema, body: updateModuleCategoryBodySchema }),
  patchModuleCategory,
);
moduleCategoriesRouter.delete(
  "/:moduleCategoryId",
  requireRole(USER_ROLES.MASTER),
  validate({ params: moduleCategoryIdParamsSchema }),
  removeModuleCategory,
);

export { moduleCategoriesRouter };
