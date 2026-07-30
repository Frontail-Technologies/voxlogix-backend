import { z } from "zod";

import { paginationQuerySchema } from "@/shared/validators/pagination.validation";

export const listModuleCategoriesQuerySchema = paginationQuerySchema.extend({
  search: z.string().trim().optional(),
  status: z.string().trim().optional(),
});

export const moduleCategoryIdParamsSchema = z.object({
  moduleCategoryId: z.string().uuid(),
});

export const moduleCategoryBodySchema = z.object({
  name: z.string().trim().min(2).max(120),
  description: z.string().trim().max(2000).optional(),
  status: z.enum(["ACTIVE", "INACTIVE"]).default("ACTIVE"),
});

export const updateModuleCategoryBodySchema = moduleCategoryBodySchema
  .partial()
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one field is required",
  });
