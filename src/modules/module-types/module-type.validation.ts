import { z } from "zod";

import { paginationQuerySchema } from "@/shared/validators/pagination.validation";

export const listModuleTypesQuerySchema = paginationQuerySchema.extend({
  search: z.string().trim().optional(),
  status: z.string().trim().optional(),
});

export const moduleTypeIdParamsSchema = z.object({
  moduleTypeId: z.string().uuid(),
});

export const moduleTypeBodySchema = z.object({
  name: z.string().trim().min(2).max(120),
  description: z.string().trim().max(2000).optional(),
  status: z.enum(["ACTIVE", "INACTIVE"]).default("ACTIVE"),
});

export const updateModuleTypeBodySchema = moduleTypeBodySchema
  .partial()
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one field is required",
  });
