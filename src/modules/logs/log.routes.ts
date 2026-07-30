import { Router } from "express";

import { requireAuth } from "@/middlewares/auth-placeholder.middleware";
import { requireRole } from "@/middlewares/role-placeholder.middleware";
import { validate } from "@/middlewares/validate.middleware";
import { USER_ROLES } from "@/shared/constants";

import {
  getLogDetail,
  getLogs,
  patchLog,
  patchLogStatus,
  postLog,
  postLogAttachment,
  removeLogAttachment,
} from "./log.controller";
import {
  listLogsQuerySchema,
  logAttachmentBodySchema,
  logAttachmentIdParamsSchema,
  logBodySchema,
  logIdParamsSchema,
  updateLogBodySchema,
  updateLogStatusBodySchema,
} from "./log.validation";

const logsRouter = Router();
const logRoles = [USER_ROLES.ADMIN, USER_ROLES.MASTER, USER_ROLES.PLANNER, USER_ROLES.EXECUTION];

logsRouter.use(requireAuth, requireRole(...logRoles));
logsRouter.get("/", validate({ query: listLogsQuerySchema }), getLogs);
logsRouter.get("/:logId", validate({ params: logIdParamsSchema }), getLogDetail);
logsRouter.post("/", validate({ body: logBodySchema }), postLog);
logsRouter.patch("/:logId", validate({ params: logIdParamsSchema, body: updateLogBodySchema }), patchLog);
logsRouter.patch("/:logId/status", validate({ params: logIdParamsSchema, body: updateLogStatusBodySchema }), patchLogStatus);
logsRouter.post("/:logId/attachments", validate({ params: logIdParamsSchema, body: logAttachmentBodySchema }), postLogAttachment);
logsRouter.delete("/:logId/attachments/:attachmentId", validate({ params: logAttachmentIdParamsSchema }), removeLogAttachment);

export { logsRouter };
