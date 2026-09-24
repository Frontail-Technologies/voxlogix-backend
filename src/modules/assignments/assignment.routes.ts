import { Router } from "express";

import { requireAuth } from "@/middlewares/auth-placeholder.middleware";
import { requireRole } from "@/middlewares/role-placeholder.middleware";
import { validate } from "@/middlewares/validate.middleware";
import { getAssignmentDetail, getAssignmentExecutors, getAssignments, patchAssignment, patchAssignmentCancelled, postAssignment } from "@/modules/assignments/assignment.controller";
import { assignmentIdParamsSchema, createAssignmentBodySchema, listAssignmentExecutorsQuerySchema, listAssignmentsQuerySchema, updateAssignmentBodySchema } from "@/modules/assignments/assignment.validation";
import { USER_ROLES } from "@/shared/constants";

const assignmentsRouter = Router();

assignmentsRouter.use(requireAuth, requireRole(USER_ROLES.PLANNER, USER_ROLES.ADMIN));
assignmentsRouter.get("/", validate({ query: listAssignmentsQuerySchema }), getAssignments);
assignmentsRouter.get("/executors/options", validate({ query: listAssignmentExecutorsQuerySchema }), getAssignmentExecutors);
assignmentsRouter.get("/:assignmentId", validate({ params: assignmentIdParamsSchema }), getAssignmentDetail);
assignmentsRouter.post("/", validate({ body: createAssignmentBodySchema }), postAssignment);
assignmentsRouter.patch("/:assignmentId", validate({ params: assignmentIdParamsSchema, body: updateAssignmentBodySchema }), patchAssignment);
assignmentsRouter.patch("/:assignmentId/cancel", validate({ params: assignmentIdParamsSchema }), patchAssignmentCancelled);

export { assignmentsRouter };
