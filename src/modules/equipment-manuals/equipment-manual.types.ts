import type { z } from "zod";

import type {
  equipmentManualBodySchema,
  listEquipmentManualsQuerySchema,
  updateEquipmentManualBodySchema,
} from "./equipment-manual.validation";

export type ListEquipmentManualsInput = z.infer<typeof listEquipmentManualsQuerySchema> & {
  companyId: string;
};

export type CreateEquipmentManualInput = z.infer<typeof equipmentManualBodySchema> & {
  companyId: string;
  createdById?: string;
};

export type UpdateEquipmentManualInput = z.infer<typeof updateEquipmentManualBodySchema>;
