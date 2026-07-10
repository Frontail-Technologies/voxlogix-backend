import { Router } from "express";

import { validate } from "@/middlewares/validate.middleware";

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

modulesRouter.get("/", validate({ query: listModulesQuerySchema }), getModules);
modulesRouter.get("/:moduleId", validate({ params: moduleIdParamsSchema }), getModule);
modulesRouter.post("/", validate({ body: createModuleBodySchema }), postModule);
modulesRouter.patch(
  "/:moduleId",
  validate({ params: moduleIdParamsSchema, body: updateModuleBodySchema }),
  patchModule,
);
modulesRouter.delete(
  "/:moduleId",
  validate({ params: moduleIdParamsSchema }),
  removeModule,
);
modulesRouter.get(
  "/:moduleId/fields",
  validate({ params: moduleIdParamsSchema }),
  getFields,
);
modulesRouter.post(
  "/:moduleId/fields",
  validate({ params: moduleIdParamsSchema, body: createModuleFieldBodySchema }),
  postField,
);
modulesRouter.patch(
  "/:moduleId/fields/:fieldId",
  validate({ params: fieldIdParamsSchema, body: updateModuleFieldBodySchema }),
  patchField,
);
modulesRouter.delete(
  "/:moduleId/fields/:fieldId",
  validate({ params: fieldIdParamsSchema }),
  removeField,
);

export { modulesRouter };
