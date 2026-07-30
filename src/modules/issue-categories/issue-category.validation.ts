import { z } from "zod";
import { paginationQuerySchema } from "@/shared/validators/pagination.validation";

export const listIssueCategoriesQuerySchema = paginationQuerySchema.extend({
  search: z.string().trim().optional(),
  moduleType: z.string().trim().optional(),
  status: z.string().trim().optional(),
});
export const issueCategoryIdParamsSchema = z.object({ issueCategoryId: z.string().uuid() });
export const issueCategoryBodySchema = z.object({
  name: z.string().trim().min(1).max(160),
  moduleType: z.string().trim().min(1).max(80).default("EQUIPMENT_LOG"),
  severityDefault: z.string().trim().min(1).max(40).default("MEDIUM"),
  status: z.string().trim().min(1).max(40).default("ACTIVE"),
});
export const updateIssueCategoryBodySchema = issueCategoryBodySchema.partial().refine((value) => Object.keys(value).length > 0, { message: "At least one field is required" });
