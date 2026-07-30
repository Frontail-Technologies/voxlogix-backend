import type { z } from "zod";

import type {
  listLogsQuerySchema,
  logAttachmentBodySchema,
  logBodySchema,
  updateLogBodySchema,
  updateLogStatusBodySchema,
} from "./log.validation";

export type ListLogsInput = z.infer<typeof listLogsQuerySchema> & { companyId: string };
export type CreateLogInput = z.infer<typeof logBodySchema> & {
  companyId: string;
  createdById?: string;
  createdByName?: string;
};
export type UpdateLogInput = z.infer<typeof updateLogBodySchema>;
export type UpdateLogStatusInput = z.infer<typeof updateLogStatusBodySchema> & {
  actorId?: string;
  actorName: string;
};
export type CreateLogAttachmentInput = z.infer<typeof logAttachmentBodySchema>;
