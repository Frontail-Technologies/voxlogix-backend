import type { z } from "zod";

import type {
  createModuleBodySchema,
  createModuleFieldBodySchema,
  listModulesQuerySchema,
  updateModuleBodySchema,
  updateModuleFieldBodySchema,
} from "./module.validation";

export type ListModulesInput = z.infer<typeof listModulesQuerySchema> & { companyId?: string; role?: string };
export type ModuleFieldInput = z.infer<typeof createModuleFieldBodySchema>;
export type CreateModuleInput = z.infer<typeof createModuleBodySchema>;
export type UpdateModuleInput = z.infer<typeof updateModuleBodySchema>;
export type UpdateModuleFieldInput = z.infer<typeof updateModuleFieldBodySchema>;

export type ModuleListRow = {
  id: string;
  name: string;
  slug: string;
  moduleTypeId: string;
  type: string;
  category: string;
  status: string;
  availabilityText: string;
  icon: string;
  color: string;
  mediaUrl: string | null;
  mediaKey: string | null;
  description: string | null;
  voiceEnabled: boolean;
  feedEnabled: boolean;
  feedOnlyOnAlert: boolean;
  requiresVoicePlayback: boolean;
  maxAttachments: number;
  fieldsCount: number;
  createdAt: Date;
  updatedAt: Date;
};

