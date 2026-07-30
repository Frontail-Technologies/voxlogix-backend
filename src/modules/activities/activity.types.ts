import type { z } from "zod";

import type { listActivitiesQuerySchema } from "./activity.validation";

export type ListActivitiesInput = z.infer<typeof listActivitiesQuerySchema>;
