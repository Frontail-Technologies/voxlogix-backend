import { GoogleGenAI, Type } from "@google/genai";
import { and, asc, desc, eq } from "drizzle-orm";
import OpenAI from "openai";

import { env } from "@/config/env";
import { db } from "@/db";
import { aiChatMessages, aiChatSessions, aiSettings, companyAiUsageDaily, equipmentAssets, operationalLogs } from "@/db/schema";
import type { ChatInput, ExtractedLogFields, ExtractLogFieldsInput, MatchEquipmentInput } from "@/modules/ai/ai.types";
import { getModuleFields } from "@/modules/modules/module.service";
import { listEquipment } from "@/modules/equipment/equipment.service";
import { AppError } from "@/shared/errors/app-error";
import { ERROR_CODES } from "@/shared/errors/error-codes";
import { HTTP_STATUS } from "@/shared/errors/http-status";

const MANUAL_TEXT_CHAR_BUDGET = 6000;
const RECENT_LOGS_LIMIT = 5;
const AI_TIMEOUT_MS = 40_000;
const SUPPORTED_PROVIDERS = ["Gemini", "OpenAI"] as const;

type ChatHistoryMessage = { role: "user" | "assistant"; content: string };

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, message: string): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout>;

  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(message)), timeoutMs);
  });

  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    clearTimeout(timeoutId!);
  }
}

type ProviderConfig = {
  id?: string;
  provider: string;
  model: string;
  apiKey: string;
};

async function resolveProviderChain(purpose: "extraction" | "chat"): Promise<ProviderConfig[]> {
  const activeConfigs = await db
    .select()
    .from(aiSettings)
    .where(eq(aiSettings.keyStatus, "Active"))
    .orderBy(desc(aiSettings.isDefault), desc(aiSettings.updatedAt));

  const chain: ProviderConfig[] = activeConfigs.map((config) => ({
    id: config.id,
    provider: config.provider,
    model: config.defaultModel,
    apiKey: config.apiKey,
  }));

  if (chain.length) {
    return chain;
  }

  if (!env.GEMINI_API_KEY) {
    throw new AppError({
      message: "AI features are not configured. Add an active AI provider in Master Settings, or set GEMINI_API_KEY on the server.",
      statusCode: HTTP_STATUS.INTERNAL_SERVER_ERROR,
      errorCode: ERROR_CODES.INTERNAL_SERVER_ERROR,
    });
  }

  return [
    {
      provider: "Gemini",
      model: purpose === "extraction" ? env.GEMINI_EXTRACTION_MODEL : env.GEMINI_CHAT_MODEL,
      apiKey: env.GEMINI_API_KEY,
    },
  ];
}

function startOfToday() {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date;
}

async function recordUsage(companyId: string, input: { aiLogs?: number; failed?: boolean }) {
  try {
    await recordUsageOrThrow(companyId, input);
  } catch {
    // Usage analytics must never fail or block the primary AI request.
  }
}

async function recordUsageOrThrow(companyId: string, input: { aiLogs?: number; failed?: boolean }) {
  const usageDate = startOfToday();

  const [existing] = await db
    .select({ id: companyAiUsageDaily.id, aiLogs: companyAiUsageDaily.aiLogs, failedRequests: companyAiUsageDaily.failedRequests })
    .from(companyAiUsageDaily)
    .where(and(eq(companyAiUsageDaily.companyId, companyId), eq(companyAiUsageDaily.usageDate, usageDate)))
    .limit(1);

  if (existing) {
    await db
      .update(companyAiUsageDaily)
      .set({
        aiLogs: existing.aiLogs + (input.aiLogs ?? 0),
        failedRequests: existing.failedRequests + (input.failed ? 1 : 0),
        updatedAt: new Date(),
      })
      .where(eq(companyAiUsageDaily.id, existing.id));
    return;
  }

  await db.insert(companyAiUsageDaily).values({
    companyId,
    usageDate,
    aiLogs: input.aiLogs ?? 0,
    failedRequests: input.failed ? 1 : 0,
    estimatedCostCents: 0,
  });
}

function deriveSessionTitle(message: string) {
  const trimmed = message.trim();
  return trimmed.length > 60 ? `${trimmed.slice(0, 57)}...` : trimmed;
}

async function ensureChatSession(companyId: string, userId: string, sessionId: string) {
  const [session] = await db
    .select()
    .from(aiChatSessions)
    .where(
      and(
        eq(aiChatSessions.id, sessionId),
        eq(aiChatSessions.companyId, companyId),
        eq(aiChatSessions.userId, userId),
      ),
    )
    .limit(1);

  if (!session) {
    throw new AppError({ message: "Chat session not found.", statusCode: HTTP_STATUS.NOT_FOUND, errorCode: ERROR_CODES.NOT_FOUND });
  }

  return session;
}

async function createChatSession(companyId: string, userId: string, equipmentId: string | null, title: string) {
  const [session] = await db
    .insert(aiChatSessions)
    .values({ companyId, userId, equipmentId, title })
    .returning();

  return session;
}

async function loadSessionHistory(sessionId: string): Promise<ChatHistoryMessage[]> {
  const rows = await db
    .select({ role: aiChatMessages.role, content: aiChatMessages.content })
    .from(aiChatMessages)
    .where(eq(aiChatMessages.sessionId, sessionId))
    .orderBy(asc(aiChatMessages.createdAt));

  return rows.map((row) => ({ role: row.role === "assistant" ? "assistant" : "user", content: row.content }));
}

async function appendChatMessage(sessionId: string, role: "user" | "assistant", content: string) {
  await db.insert(aiChatMessages).values({ sessionId, role, content });
  await db.update(aiChatSessions).set({ updatedAt: new Date() }).where(eq(aiChatSessions.id, sessionId));
}

export async function listChatSessions(companyId: string, userId: string, equipmentId?: string) {
  const filters = [eq(aiChatSessions.companyId, companyId), eq(aiChatSessions.userId, userId)];
  if (equipmentId) filters.push(eq(aiChatSessions.equipmentId, equipmentId));

  return db
    .select({
      id: aiChatSessions.id,
      title: aiChatSessions.title,
      equipmentId: aiChatSessions.equipmentId,
      equipmentName: equipmentAssets.name,
      updatedAt: aiChatSessions.updatedAt,
    })
    .from(aiChatSessions)
    .leftJoin(equipmentAssets, eq(aiChatSessions.equipmentId, equipmentAssets.id))
    .where(and(...filters))
    .orderBy(desc(aiChatSessions.updatedAt))
    .limit(30);
}

export async function getChatSession(companyId: string, userId: string, sessionId: string) {
  const [session] = await db
    .select({
      id: aiChatSessions.id,
      title: aiChatSessions.title,
      equipmentId: aiChatSessions.equipmentId,
      createdAt: aiChatSessions.createdAt,
      updatedAt: aiChatSessions.updatedAt,
    })
    .from(aiChatSessions)
    .where(
      and(
        eq(aiChatSessions.id, sessionId),
        eq(aiChatSessions.companyId, companyId),
        eq(aiChatSessions.userId, userId),
      ),
    )
    .limit(1);

  if (!session) {
    throw new AppError({ message: "Chat session not found.", statusCode: HTTP_STATUS.NOT_FOUND, errorCode: ERROR_CODES.NOT_FOUND });
  }

  const messages = await db
    .select({ id: aiChatMessages.id, role: aiChatMessages.role, content: aiChatMessages.content, createdAt: aiChatMessages.createdAt })
    .from(aiChatMessages)
    .where(eq(aiChatMessages.sessionId, sessionId))
    .orderBy(asc(aiChatMessages.createdAt));

  return { ...session, messages };
}

type ModuleFieldRow = Awaited<ReturnType<typeof getModuleFields>>[number];

function buildGeminiExtractionSchema(extractableFields: ModuleFieldRow[]) {
  const properties: Record<string, { type: Type; enum?: string[] }> = {};
  for (const field of extractableFields) {
    const property: { type: Type; enum?: string[] } = {
      type: field.type === "Number" ? Type.NUMBER : Type.STRING,
    };
    if (field.type === "Select" && field.options?.length) {
      property.enum = field.options;
    }
    properties[field.key] = property;
  }

  return {
    type: Type.OBJECT,
    properties,
    required: extractableFields.map((field) => field.key),
  };
}

function buildOpenAiExtractionSchema(extractableFields: ModuleFieldRow[]) {
  const properties: Record<string, { type: string; enum?: string[] }> = {};
  for (const field of extractableFields) {
    const property: { type: string; enum?: string[] } = {
      type: field.type === "Number" ? "number" : "string",
    };
    if (field.type === "Select" && field.options?.length) {
      property.enum = field.options;
    }
    properties[field.key] = property;
  }

  return {
    type: "object",
    properties,
    required: extractableFields.map((field) => field.key),
    additionalProperties: false,
  };
}

function buildFieldDescriptions(extractableFields: ModuleFieldRow[]) {
  return extractableFields
    .map((field) => {
      const optionsNote = field.options?.length ? ` One of: ${field.options.join(", ")}.` : "";
      const typeNote = field.type === "Number" ? " A number." : field.type === "Date" ? " An ISO date string." : "";
      return `- "${field.key}" (${field.label}):${typeNote}${optionsNote}`;
    })
    .join("\n");
}

async function callGeminiExtract(config: ProviderConfig, transcript: string, systemInstruction: string, extractableFields: ModuleFieldRow[]) {
  const client = new GoogleGenAI({ apiKey: config.apiKey });

  const response = await withTimeout(
    client.models.generateContent({
      model: config.model,
      contents: [{ role: "user", parts: [{ text: transcript }] }],
      config: {
        systemInstruction,
        responseMimeType: "application/json",
        responseSchema: buildGeminiExtractionSchema(extractableFields),
        maxOutputTokens: 1024,
      },
    }),
    AI_TIMEOUT_MS,
    "AI extraction timed out.",
  );

  const text = response.text;
  if (!text) {
    throw new Error("Empty response from model.");
  }

  return JSON.parse(text) as ExtractedLogFields;
}

async function callOpenAiExtract(config: ProviderConfig, transcript: string, systemInstruction: string, extractableFields: ModuleFieldRow[]) {
  const client = new OpenAI({ apiKey: config.apiKey });

  const response = await withTimeout(
    client.chat.completions.create({
      model: config.model,
      messages: [
        { role: "system", content: systemInstruction },
        { role: "user", content: transcript },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "extracted_log_fields",
          strict: true,
          schema: buildOpenAiExtractionSchema(extractableFields),
        },
      },
      max_tokens: 1024,
    }),
    AI_TIMEOUT_MS,
    "AI extraction timed out.",
  );

  const text = response.choices[0]?.message?.content;
  if (!text) {
    throw new Error("Empty response from model.");
  }

  return JSON.parse(text) as ExtractedLogFields;
}

async function callExtract(config: ProviderConfig, transcript: string, systemInstruction: string, extractableFields: ModuleFieldRow[]) {
  if (config.provider === "OpenAI") {
    return callOpenAiExtract(config, transcript, systemInstruction, extractableFields);
  }
  if (config.provider === "Gemini") {
    return callGeminiExtract(config, transcript, systemInstruction, extractableFields);
  }
  throw new Error(`AI provider "${config.provider}" is not yet supported. Supported providers: ${SUPPORTED_PROVIDERS.join(", ")}.`);
}

export async function extractLogFields(input: ExtractLogFieldsInput): Promise<ExtractedLogFields> {
  const requestStart = Date.now();
  console.log(
    `[ai] extract-log-fields start moduleId=${input.moduleId} equipmentId=${input.equipmentId ?? "none"} transcriptChars=${input.transcript.length}`,
  );

  const chain = await resolveProviderChain("extraction");
  console.log(
    `[ai] provider chain resolved in ${Date.now() - requestStart}ms: ${chain.map((c) => `${c.provider}${c.id ? `(${c.id})` : "(env)"}`).join(", ") || "none"}`,
  );

  const moduleFields = await getModuleFields(input.moduleId);
  const extractableFields = moduleFields.filter((field) => field.aiExtract);
  console.log(`[ai] module fields loaded in ${Date.now() - requestStart}ms, extractable=${extractableFields.length}`);

  if (!extractableFields.length) {
    throw new AppError({
      message: "This module has no AI-extractable fields configured.",
      statusCode: HTTP_STATUS.BAD_REQUEST,
      errorCode: ERROR_CODES.VALIDATION_ERROR,
    });
  }

  let equipmentContext = "";
  if (input.equipmentId) {
    const [equipment] = await db
      .select({
        name: equipmentAssets.name,
        equipmentCode: equipmentAssets.equipmentCode,
        category: equipmentAssets.category,
        section: equipmentAssets.section,
        subLocation: equipmentAssets.subLocation,
        criticality: equipmentAssets.criticality,
      })
      .from(equipmentAssets)
      .where(and(eq(equipmentAssets.id, input.equipmentId), eq(equipmentAssets.companyId, input.companyId)))
      .limit(1);

    if (equipment) {
      equipmentContext = `Equipment context: ${equipment.name} (${equipment.equipmentCode}), category ${equipment.category}, located at ${equipment.section} / ${equipment.subLocation}, default criticality ${equipment.criticality}.`;
    }
  }

  const systemInstruction = [
    "You are an industrial maintenance assistant. A field technician has just described an equipment issue by voice.",
    "Extract the following fields from their transcript for a maintenance log:",
    buildFieldDescriptions(extractableFields),
    "If the transcript does not mention a field, make a reasonable, conservative inference from context; never leave a field empty.",
    equipmentContext,
  ]
    .filter(Boolean)
    .join("\n");

  let lastError: unknown;
  for (const config of chain) {
    const attemptStart = Date.now();
    const providerLabel = `${config.provider}${config.id ? ` (${config.id})` : " (env fallback)"}`;
    console.log(`[ai] calling ${providerLabel} model=${config.model}, timeout=${AI_TIMEOUT_MS}ms`);

    try {
      const parsed = await callExtract(config, input.transcript, systemInstruction, extractableFields);
      console.log(`[ai] ${providerLabel} succeeded in ${Date.now() - attemptStart}ms (total ${Date.now() - requestStart}ms)`);
      void recordUsage(input.companyId, { aiLogs: 1 });
      return parsed;
    } catch (error) {
      lastError = error;
      console.error(
        `[ai] ${providerLabel} failed after ${Date.now() - attemptStart}ms (total ${Date.now() - requestStart}ms)${chain.length > 1 ? ", trying next provider" : ""}`,
        error,
      );
    }
  }

  void recordUsage(input.companyId, { aiLogs: 1, failed: true });
  console.error(`[ai] extract-log-fields exhausted all providers after ${Date.now() - requestStart}ms`);

  if (lastError instanceof AppError) {
    throw lastError;
  }

  throw new AppError({
    message: "Could not extract log details from the transcript. Please try again or fill the form manually.",
    statusCode: HTTP_STATUS.INTERNAL_SERVER_ERROR,
    errorCode: ERROR_CODES.INTERNAL_SERVER_ERROR,
  });
}

async function callGeminiChat(
  config: ProviderConfig,
  systemInstruction: string,
  history: ChatHistoryMessage[],
  message: string,
) {
  const client = new GoogleGenAI({ apiKey: config.apiKey });

  const contents = [
    ...history.map((entry) => ({
      role: entry.role === "user" ? "user" : "model",
      parts: [{ text: entry.content }],
    })),
    { role: "user", parts: [{ text: message }] },
  ];

  const response = await withTimeout(
    client.models.generateContent({
      model: config.model,
      contents,
      config: { systemInstruction, maxOutputTokens: 1024 },
    }),
    AI_TIMEOUT_MS,
    "AI chat response timed out.",
  );

  return response.text?.trim();
}

async function callOpenAiChat(
  config: ProviderConfig,
  systemInstruction: string,
  history: ChatHistoryMessage[],
  message: string,
) {
  const client = new OpenAI({ apiKey: config.apiKey });

  const response = await withTimeout(
    client.chat.completions.create({
      model: config.model,
      messages: [
        { role: "system", content: systemInstruction },
        ...history.map((entry) => ({
          role: entry.role === "user" ? ("user" as const) : ("assistant" as const),
          content: entry.content,
        })),
        { role: "user", content: message },
      ],
      max_tokens: 1024,
    }),
    AI_TIMEOUT_MS,
    "AI chat response timed out.",
  );

  return response.choices[0]?.message?.content?.trim();
}

async function callChat(config: ProviderConfig, systemInstruction: string, history: ChatHistoryMessage[], message: string) {
  if (config.provider === "OpenAI") {
    return callOpenAiChat(config, systemInstruction, history, message);
  }
  if (config.provider === "Gemini") {
    return callGeminiChat(config, systemInstruction, history, message);
  }
  throw new Error(`AI provider "${config.provider}" is not yet supported. Supported providers: ${SUPPORTED_PROVIDERS.join(", ")}.`);
}

type EquipmentMention = Awaited<ReturnType<typeof listEquipment>>["items"][number];

async function resolveEquipmentMention(
  companyId: string,
  text: string,
): Promise<{ single: EquipmentMention | null; candidates: EquipmentMention[] }> {
  const chain = await resolveProviderChain("chat");
  const config = chain[0];

  const prompt = [
    "Extract the equipment name or ID mentioned in this field technician's message, if any.",
    'Respond with ONLY the equipment name or code as plain text, or the single word "NONE" if no specific equipment is mentioned.',
    `Message: "${text}"`,
  ].join("\n\n");

  let mention: string | undefined;
  try {
    if (config.provider === "OpenAI") {
      const client = new OpenAI({ apiKey: config.apiKey });
      const response = await withTimeout(
        client.chat.completions.create({
          model: config.model,
          messages: [{ role: "user", content: prompt }],
          max_tokens: 40,
        }),
        AI_TIMEOUT_MS,
        "Equipment match timed out.",
      );
      mention = response.choices[0]?.message?.content?.trim();
    } else {
      const client = new GoogleGenAI({ apiKey: config.apiKey });
      const response = await withTimeout(
        client.models.generateContent({
          model: config.model,
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          config: { maxOutputTokens: 40 },
        }),
        AI_TIMEOUT_MS,
        "Equipment match timed out.",
      );
      mention = response.text?.trim();
    }
  } catch (error) {
    console.error("[ai] equipment match extraction failed, falling back to no match", error);
    return { single: null, candidates: [] };
  }

  if (!mention || mention.toUpperCase().includes("NONE")) {
    return { single: null, candidates: [] };
  }

  const matches = await listEquipment({ companyId, search: mention, page: 1, limit: 5 });

  if (matches.items.length === 1) {
    return { single: matches.items[0], candidates: [] };
  }
  if (matches.items.length > 1) {
    return { single: null, candidates: matches.items.slice(0, 4) };
  }
  return { single: null, candidates: [] };
}

export async function chatWithEquipmentAssistant(input: ChatInput) {
  const chain = await resolveProviderChain("chat");

  const session = input.sessionId
    ? await ensureChatSession(input.companyId, input.userId, input.sessionId)
    : await createChatSession(input.companyId, input.userId, input.equipmentId ?? null, deriveSessionTitle(input.message));

  const history = await loadSessionHistory(session.id);
  await appendChatMessage(session.id, "user", input.message);

  let equipmentId = session.equipmentId ?? input.equipmentId ?? null;

  if (!equipmentId) {
    const { single, candidates } = await resolveEquipmentMention(input.companyId, input.message);

    if (single) {
      equipmentId = single.id;
    } else {
      const clarify = candidates.length
        ? "I found a few pieces of equipment that might match — which one did you mean? You can also search for it below."
        : "Which equipment is this about? Tell me its name or ID, or search for it below.";
      await appendChatMessage(session.id, "assistant", clarify);
      return { reply: clarify, sessionId: session.id, suggestions: candidates };
    }
  }

  const [equipment] = await db
    .select({
      name: equipmentAssets.name,
      equipmentCode: equipmentAssets.equipmentCode,
      category: equipmentAssets.category,
      section: equipmentAssets.section,
      subLocation: equipmentAssets.subLocation,
      makeBrand: equipmentAssets.makeBrand,
      modelNumber: equipmentAssets.modelNumber,
      criticality: equipmentAssets.criticality,
      status: equipmentAssets.status,
      manualText: equipmentAssets.manualText,
    })
    .from(equipmentAssets)
    .where(and(eq(equipmentAssets.id, equipmentId), eq(equipmentAssets.companyId, input.companyId)))
    .limit(1);

  if (!equipment) {
    throw new AppError({ message: "Equipment not found.", statusCode: HTTP_STATUS.NOT_FOUND, errorCode: ERROR_CODES.NOT_FOUND });
  }

  if (!session.equipmentId) {
    await db.update(aiChatSessions).set({ equipmentId, updatedAt: new Date() }).where(eq(aiChatSessions.id, session.id));
  }

  const manualExcerpt = equipment.manualText
    ? equipment.manualText.slice(0, MANUAL_TEXT_CHAR_BUDGET)
    : null;

  // Log-history context: strictly scoped to operational_logs for this company+equipment,
  // via the same parameterized query pattern used everywhere else in this codebase.
  // Never touches admins/companies/aiSettings or any other table.
  const recentLogs = await db
    .select({
      title: operationalLogs.title,
      status: operationalLogs.status,
      description: operationalLogs.description,
      createdAt: operationalLogs.createdAt,
    })
    .from(operationalLogs)
    .where(and(eq(operationalLogs.companyId, input.companyId), eq(operationalLogs.equipmentId, equipmentId)))
    .orderBy(desc(operationalLogs.createdAt))
    .limit(RECENT_LOGS_LIMIT);

  const recentLogsContext = recentLogs.length
    ? `Recent field logs for this equipment (most recent first):\n${recentLogs
        .map((log) => `- [${log.createdAt.toISOString().slice(0, 10)}] ${log.title} (status: ${log.status})${log.description ? `: ${log.description}` : ""}`)
        .join("\n")}`
    : "No prior field logs are recorded for this equipment yet.";

  const systemInstruction = [
    "You are a helpful equipment expert assistant for field technicians, embedded in an industrial maintenance app.",
    `You are answering questions about this specific equipment: ${equipment.name} (${equipment.equipmentCode}), category ${equipment.category}, make/model ${equipment.makeBrand ?? "unknown"} ${equipment.modelNumber ?? ""}, located at ${equipment.section} / ${equipment.subLocation}, criticality ${equipment.criticality}, status ${equipment.status}.`,
    manualExcerpt
      ? `Here is the equipment manual content to ground your answers in:\n"""\n${manualExcerpt}\n"""`
      : "No equipment manual has been uploaded for this equipment yet, so answer from general industrial maintenance best practices and clearly say when you are not referencing a specific manual.",
    recentLogsContext,
    "You may reference the field logs above (e.g. recurring issues, what happened last time) when relevant, but never invent details not present in them.",
    "Keep answers concise, practical, and safety-conscious. Use short paragraphs or numbered steps. If a task requires lockout/tagout or specialist service, say so explicitly.",
  ].join("\n\n");

  let lastError: unknown;
  for (const config of chain) {
    try {
      const reply = await callChat(config, systemInstruction, history, input.message);

      if (!reply) {
        throw new Error("Empty response from model.");
      }

      await appendChatMessage(session.id, "assistant", reply);
      void recordUsage(input.companyId, { aiLogs: 1 });
      return {
        reply,
        sessionId: session.id,
        equipment: { id: equipmentId, name: equipment.name, equipmentCode: equipment.equipmentCode },
      };
    } catch (error) {
      lastError = error;
      console.error(
        `[ai] chat failed via ${config.provider}${config.id ? ` (${config.id})` : " (env fallback)"}${chain.length > 1 ? ", trying next provider" : ""}`,
        error,
      );
    }
  }

  void recordUsage(input.companyId, { aiLogs: 1, failed: true });

  if (lastError instanceof AppError) {
    throw lastError;
  }

  throw new AppError({
    message: "The AI assistant could not respond right now. Please try again.",
    statusCode: HTTP_STATUS.INTERNAL_SERVER_ERROR,
    errorCode: ERROR_CODES.INTERNAL_SERVER_ERROR,
  });
}

export async function matchEquipmentFromTranscript(input: MatchEquipmentInput) {
  const { single } = await resolveEquipmentMention(input.companyId, input.transcript);
  return { equipment: single };
}
