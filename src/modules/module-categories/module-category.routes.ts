import { Router } from "express";

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

const moduleCategoriesRouter = Router();

moduleCategoriesRouter.get("/", validate({ query: listModuleCategoriesQuerySchema }), getModuleCategories);
moduleCategoriesRouter.get(
  "/:moduleCategoryId",
  validate({ params: moduleCategoryIdParamsSchema }),
  getModuleCategoryDetail,
);
moduleCategoriesRouter.post("/", validate({ body: moduleCategoryBodySchema }), postModuleCategory);
moduleCategoriesRouter.patch(
  "/:moduleCategoryId",
  validate({ params: moduleCategoryIdParamsSchema, body: updateModuleCategoryBodySchema }),
  patchModuleCategory,
);
moduleCategoriesRouter.delete(
  "/:moduleCategoryId",
  validate({ params: moduleCategoryIdParamsSchema }),
  removeModuleCategory,
);

export { moduleCategoriesRouter };
