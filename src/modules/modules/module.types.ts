import type { z } from "zod";

import type {
  createModuleBodySchema,
  createModuleFieldBodySchema,
  listModulesQuerySchema,
  updateModuleBodySchema,
  updateModuleFieldBodySchema,
} from "./module.validation";

export type ListModulesInput = z.infer<typeof listModulesQuerySchema>;
export type ModuleFieldInput = z.infer<typeof createModuleFieldBodySchema>;
export type CreateModuleInput = z.infer<typeof createModuleBodySchema>;
export type UpdateModuleInput = z.infer<typeof updateModuleBodySchema>;
export type UpdateModuleFieldInput = z.infer<typeof updateModuleFieldBodySchema>;

export type ModuleListRow = {
  id: string;
  name: string;
  slug: string;
  type: string;
  category: string;
  status: string;
  availabilityText: string;
  icon: string;
  color: string;
  description: string | null;
  fieldsCount: number;
  createdAt: Date;
  updatedAt: Date;
};
