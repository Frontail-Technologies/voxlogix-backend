import { z } from "zod";

export const extractLogFieldsBodySchema = z.object({
  transcript: z.string().trim().min(3).max(10000),
  moduleId: z.string().uuid(),
  equipmentId: z.string().uuid().optional().nullable(),
});

export const chatMessageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().trim().min(1).max(4000),
});

export const chatBodySchema = z.object({
  equipmentId: z.string().uuid().optional(),
  message: z.string().trim().min(1).max(2000),
  sessionId: z.string().uuid().optional(),
});

export const listChatSessionsQuerySchema = z.object({
  equipmentId: z.string().uuid().optional(),
});

export const chatSessionIdParamsSchema = z.object({
  sessionId: z.string().uuid(),
});

export const matchEquipmentBodySchema = z.object({
  transcript: z.string().trim().min(3).max(10000),
});
