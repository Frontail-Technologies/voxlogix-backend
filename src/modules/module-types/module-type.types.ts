import type { z } from "zod";

import type {
  listModuleTypesQuerySchema,
  moduleTypeBodySchema,
  updateModuleTypeBodySchema,
} from "./module-type.validation";

export type ListModuleTypesInput = z.infer<typeof listModuleTypesQuerySchema>;
export type CreateModuleTypeInput = z.infer<typeof moduleTypeBodySchema>;
export type UpdateModuleTypeInput = z.infer<typeof updateModuleTypeBodySchema>;
