import type { z } from "zod";

import type {
  equipmentBodySchema,
  listEquipmentQuerySchema,
  updateEquipmentBodySchema,
} from "./equipment.validation";

export type ListEquipmentInput = z.infer<typeof listEquipmentQuerySchema> & {
  companyId: string;
};
export type CreateEquipmentInput = z.infer<typeof equipmentBodySchema> & {
  companyId: string;
};
export type UpdateEquipmentInput = z.infer<typeof updateEquipmentBodySchema>;
