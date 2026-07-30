import { z } from "zod";

export const masterDataSourceKeySchema = z.enum([
  "equipment_master",
  "issue_categories",
  "safety_reporting",
  "measuring_points",
  "meter_counters",
  "users_roles",
  "sections_locations_shift",
  "kaizen",
]);

export const masterDataOptionsParamsSchema = z.object({
  sourceKey: masterDataSourceKeySchema,
});

export const masterDataOptionsQuerySchema = z.object({
  fieldKey: z.string().trim().min(1).optional(),
});
