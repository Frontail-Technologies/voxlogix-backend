import { z } from "zod";

export const commonIdSchema = z.object({
  id: z.string().min(1),
});
