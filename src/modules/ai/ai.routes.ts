import { Router } from "express";

import { requireAuth } from "@/middlewares/auth-placeholder.middleware";
import { requireRole } from "@/middlewares/role-placeholder.middleware";
import { validate } from "@/middlewares/validate.middleware";
import { USER_ROLES } from "@/shared/constants";

import {
  getChatSessionDetail,
  getChatSessions,
  patchChatSession,
  postChat,
  postExtractLogFields,
  removeChatSession,
} from "./ai.controller";
import {
  chatBodySchema,
  chatSessionIdParamsSchema,
  extractLogFieldsBodySchema,
  listChatSessionsQuerySchema,
  updateChatSessionBodySchema,
} from "./ai.validation";

const aiRouter = Router();
const aiRoles = [USER_ROLES.ADMIN, USER_ROLES.MASTER, USER_ROLES.PLANNER, USER_ROLES.EXECUTION];

aiRouter.use(requireAuth, requireRole(...aiRoles));
aiRouter.post("/extract-log-fields", validate({ body: extractLogFieldsBodySchema }), postExtractLogFields);
aiRouter.post("/chat", validate({ body: chatBodySchema }), postChat);
aiRouter.get("/chat/sessions", validate({ query: listChatSessionsQuerySchema }), getChatSessions);
aiRouter.get("/chat/sessions/:sessionId", validate({ params: chatSessionIdParamsSchema }), getChatSessionDetail);
aiRouter.patch(
  "/chat/sessions/:sessionId",
  validate({ params: chatSessionIdParamsSchema, body: updateChatSessionBodySchema }),
  patchChatSession,
);
aiRouter.delete("/chat/sessions/:sessionId", validate({ params: chatSessionIdParamsSchema }), removeChatSession);

export { aiRouter };
