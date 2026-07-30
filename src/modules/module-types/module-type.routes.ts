import { Router } from "express";

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

const moduleTypesRouter = Router();

moduleTypesRouter.get("/", validate({ query: listModuleTypesQuerySchema }), getModuleTypes);
moduleTypesRouter.get("/:moduleTypeId", validate({ params: moduleTypeIdParamsSchema }), getModuleTypeDetail);
moduleTypesRouter.post("/", validate({ body: moduleTypeBodySchema }), postModuleType);
moduleTypesRouter.patch(
  "/:moduleTypeId",
  validate({ params: moduleTypeIdParamsSchema, body: updateModuleTypeBodySchema }),
  patchModuleType,
);
moduleTypesRouter.delete("/:moduleTypeId", validate({ params: moduleTypeIdParamsSchema }), removeModuleType);

export { moduleTypesRouter };
