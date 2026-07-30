import type { z } from "zod";

import type {
  listModuleCategoriesQuerySchema,
  moduleCategoryBodySchema,
  updateModuleCategoryBodySchema,
} from "@/modules/module-categories/module-category.validation";

export type ListModuleCategoriesInput = z.infer<typeof listModuleCategoriesQuerySchema>;
export type CreateModuleCategoryInput = z.infer<typeof moduleCategoryBodySchema>;
export type UpdateModuleCategoryInput = z.infer<typeof updateModuleCategoryBodySchema>;
