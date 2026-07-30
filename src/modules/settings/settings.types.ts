import type { z } from "zod";

import type {
  createAiProviderConfigBodySchema,
  updateAiSettingsBodySchema,
  updateGeneralSettingsBodySchema,
} from "./settings.validation";

export type CreateAiProviderConfigInput = z.infer<typeof createAiProviderConfigBodySchema>;
export type UpdateAiSettingsInput = z.infer<typeof updateAiSettingsBodySchema>;
export type UpdateGeneralSettingsInput = z.infer<typeof updateGeneralSettingsBodySchema>;