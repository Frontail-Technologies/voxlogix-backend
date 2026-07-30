import type { Request, Response } from "express";

import {
  chatWithEquipmentAssistant,
  extractLogFields,
  getChatSession,
  listChatSessions,
  matchEquipmentFromTranscript,
} from "@/modules/ai/ai.service";
import { sendSuccess } from "@/shared/helpers/api-response";
import { asyncHandler } from "@/shared/helpers/async-handler";

function companyIdOf(request: Request) {
  return String(request.user?.companyId ?? "");
}

function userIdOf(request: Request) {
  return String(request.user?.id ?? "");
}

function paramOf(request: Request, name: string) {
  const value = request.params[name];
  return Array.isArray(value) ? value[0] : String(value);
}

export const postExtractLogFields = asyncHandler(async (request: Request, response: Response) => {
  const result = await extractLogFields({ companyId: companyIdOf(request), ...request.body });
  return sendSuccess(response, { data: result });
});

export const postChat = asyncHandler(async (request: Request, response: Response) => {
  const result = await chatWithEquipmentAssistant({
    companyId: companyIdOf(request),
    userId: userIdOf(request),
    ...request.body,
  });
  return sendSuccess(response, { data: result });
});

export const getChatSessions = asyncHandler(async (request: Request, response: Response) => {
  const equipmentId = typeof request.query.equipmentId === "string" ? request.query.equipmentId : undefined;
  const sessions = await listChatSessions(companyIdOf(request), userIdOf(request), equipmentId);
  return sendSuccess(response, { data: sessions });
});

export const getChatSessionDetail = asyncHandler(async (request: Request, response: Response) => {
  const session = await getChatSession(companyIdOf(request), userIdOf(request), paramOf(request, "sessionId"));
  return sendSuccess(response, { data: session });
});

export const postMatchEquipment = asyncHandler(async (request: Request, response: Response) => {
  const result = await matchEquipmentFromTranscript({ companyId: companyIdOf(request), ...request.body });
  return sendSuccess(response, { data: result });
});
