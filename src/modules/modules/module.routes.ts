import { Router } from "express";

import { requireAuth } from "@/middlewares/auth-placeholder.middleware";
import { parseMultipartPayload } from "@/middlewares/multipart-payload.middleware";
import { requireRole } from "@/middlewares/role-placeholder.middleware";
import { validate } from "@/middlewares/validate.middleware";
import { singleImageUploadMiddleware } from "@/modules/uploads/uploads.middleware";
import { USER_ROLES } from "@/shared/constants";

import {
  getFields,
  getModule,
  getModules,
  patchField,
  patchModule,
  postField,
  postModule,
  removeField,
  removeModule,
} from "./module.controller";
import {
  createModuleBodySchema,
  createModuleFieldBodySchema,
  fieldIdParamsSchema,
  listModulesQuerySchema,
  moduleIdParamsSchema,
  updateModuleBodySchema,
  updateModuleFieldBodySchema,
} from "./module.validation";

const modulesRouter = Router();
const viewRoles = [USER_ROLES.ADMIN, USER_ROLES.MASTER, USER_ROLES.PLANNER, USER_ROLES.EXECUTION];

modulesRouter.use(requireAuth);

modulesRouter.get("/", requireRole(...viewRoles), validate({ query: listModulesQuerySchema }), getModules);
modulesRouter.get("/:moduleId", requireRole(...viewRoles), validate({ params: moduleIdParamsSchema }), getModule);
modulesRouter.post(
  "/",
  requireRole(USER_ROLES.MASTER),
  singleImageUploadMiddleware,
  parseMultipartPayload,
  validate({ body: createModuleBodySchema }),
  postModule,
);
modulesRouter.patch(
  "/:moduleId",
  requireRole(USER_ROLES.MASTER),
  singleImageUploadMiddleware,
  parseMultipartPayload,
  validate({ params: moduleIdParamsSchema, body: updateModuleBodySchema }),
  patchModule,
);
modulesRouter.delete(
  "/:moduleId",
  requireRole(USER_ROLES.MASTER),
  validate({ params: moduleIdParamsSchema }),
  removeModule,
);
modulesRouter.get(
  "/:moduleId/fields",
  requireRole(...viewRoles),
  validate({ params: moduleIdParamsSchema }),
  getFields,
);
modulesRouter.post(
  "/:moduleId/fields",
  requireRole(USER_ROLES.MASTER),
  validate({ params: moduleIdParamsSchema, body: createModuleFieldBodySchema }),
  postField,
);
modulesRouter.patch(
  "/:moduleId/fields/:fieldId",
  requireRole(USER_ROLES.MASTER),
  validate({ params: fieldIdParamsSchema, body: updateModuleFieldBodySchema }),
  patchField,
);
modulesRouter.delete(
  "/:moduleId/fields/:fieldId",
  requireRole(USER_ROLES.MASTER),
  validate({ params: fieldIdParamsSchema }),
  removeField,
);

export { modulesRouter };
