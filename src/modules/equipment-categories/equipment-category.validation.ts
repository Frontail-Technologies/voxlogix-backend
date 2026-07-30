import { z } from "zod";
import { paginationQuerySchema } from "@/shared/validators/pagination.validation";

export const listEquipmentCategoriesQuerySchema = paginationQuerySchema.extend({
  search: z.string().trim().optional(),
  status: z.string().trim().optional(),
});
export const equipmentCategoryIdParamsSchema = z.object({ equipmentCategoryId: z.string().uuid() });
export const equipmentCategoryBodySchema = z.object({
  name: z.string().trim().min(1).max(160),
  status: z.string().trim().min(1).max(40).default("ACTIVE"),
});
export const updateEquipmentCategoryBodySchema = equipmentCategoryBodySchema.partial().refine((value) => Object.keys(value).length > 0, { message: "At least one field is required" });
