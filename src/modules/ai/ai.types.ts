import type { z } from "zod";

import type { chatBodySchema, extractLogFieldsBodySchema } from "./ai.validation";

export type ExtractLogFieldsInput = z.infer<typeof extractLogFieldsBodySchema> & {
  companyId: string;
};

export type ChatInput = z.infer<typeof chatBodySchema> & {
  companyId: string;
  userId: string;
};

export type ExtractedLogFields = Record<string, string | number | null>;
