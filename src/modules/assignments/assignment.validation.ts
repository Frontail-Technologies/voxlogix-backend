import { z } from "zod";

import { ASSIGNMENT_STATUS } from "@/modules/assignments/assignment.domain";

const assignmentFields = {
  assignedToUserId: z.string().uuid(),
  title: z.string().trim().min(1).max(180),
  description: z.string().trim().max(2000).optional().nullable(),
  scheduledAt: z.coerce.date(),
};

export const createAssignmentBodySchema = z.object(assignmentFields);

export const updateAssignmentBodySchema = z.object(assignmentFields).partial().refine(
  (value) => Object.keys(value).length > 0,
  { message: "At least one field is required" },
);

export const assignmentIdParamsSchema = z.object({ assignmentId: z.string().uuid() });

export const listAssignmentsQuerySchema = z.object({
  status: z.enum([ASSIGNMENT_STATUS.SCHEDULED, ASSIGNMENT_STATUS.CANCELLED, ASSIGNMENT_STATUS.COMPLETED]).optional(),
});

export const listAssignmentExecutorsQuerySchema = z.object({
  search: z.string().trim().max(160).optional(),
});

export type CreateAssignmentInput = z.infer<typeof createAssignmentBodySchema>;
export type UpdateAssignmentInput = z.infer<typeof updateAssignmentBodySchema>;
