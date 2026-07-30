import { and, asc, count, desc, eq, ilike, or, type SQL } from "drizzle-orm";
import { PDFParse } from "pdf-parse";

import { db } from "@/db";
import { equipmentAssets, equipmentManualChunks, equipmentManuals } from "@/db/schema";
import type { UploadAssetResult } from "@/lib/storage";
import type {
  CreateEquipmentManualInput,
  ListEquipmentManualsInput,
  UpdateEquipmentManualInput,
} from "@/modules/equipment-manuals/equipment-manual.types";
import { AppError } from "@/shared/errors/app-error";
import { ERROR_CODES } from "@/shared/errors/error-codes";
import { HTTP_STATUS } from "@/shared/errors/http-status";
import { buildPagination } from "@/shared/helpers/pagination";
import { sanitizeString } from "@/shared/helpers/sanitize";

const CHUNK_CHAR_LIMIT = 2800;
const PDF_MIME_TYPE = "application/pdf";
const SEED_CONTEXT_MARKER = "Detailed PDF text extraction has not been run yet";

type ManualSourceFile = { buffer: Buffer; mimeType: string; originalName: string } | null;
type ManualContextExtractionInput = {
  companyId: string;
  equipmentId: string;
  manualId: string;
  manualUrl: string;
  mimeType?: string | null;
};

function buildManualFilter(input: Omit<ListEquipmentManualsInput, "page" | "limit">) {
  const filters: SQL<unknown>[] = [eq(equipmentManuals.companyId, input.companyId)];
  if (input.equipmentId) filters.push(eq(equipmentManuals.equipmentId, input.equipmentId));
  if (input.status) filters.push(eq(equipmentManuals.status, input.status));
  if (input.search) {
    filters.push(or(ilike(equipmentManuals.title, `%${input.search}%`), ilike(equipmentManuals.fileName, `%${input.search}%`), ilike(equipmentAssets.name, `%${input.search}%`), ilike(equipmentAssets.equipmentCode, `%${input.search}%`))!);
  }
  return and(...filters);
}

async function ensureEquipment(companyId: string, equipmentId: string) {
  const [equipment] = await db
    .select({ id: equipmentAssets.id, equipmentCode: equipmentAssets.equipmentCode, name: equipmentAssets.name })
    .from(equipmentAssets)
    .where(and(eq(equipmentAssets.id, equipmentId), eq(equipmentAssets.companyId, companyId)))
    .limit(1);
  if (!equipment) throw new AppError({ message: "Equipment not found.", statusCode: HTTP_STATUS.NOT_FOUND, errorCode: ERROR_CODES.NOT_FOUND });
  return equipment;
}

async function ensureManual(companyId: string, manualId: string) {
  const [manual] = await db.select().from(equipmentManuals).where(and(eq(equipmentManuals.id, manualId), eq(equipmentManuals.companyId, companyId))).limit(1);
  if (!manual) throw new AppError({ message: "Equipment manual not found.", statusCode: HTTP_STATUS.NOT_FOUND, errorCode: ERROR_CODES.NOT_FOUND });
  return manual;
}

function normalizeManualText(value?: string | null) {
  const text = value?.replace(/\r\n/g, "\n").replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
  return text ? text : null;
}

function splitManualText(text: string) {
  const paragraphs = text.split(/\n{2,}/g).map((part) => part.trim()).filter(Boolean);
  const chunks: string[] = [];
  let current = "";
  for (const paragraph of paragraphs.length ? paragraphs : [text]) {
    const next = current ? `${current}\n\n${paragraph}` : paragraph;
    if (next.length <= CHUNK_CHAR_LIMIT) {
      current = next;
      continue;
    }
    if (current) chunks.push(current);
    if (paragraph.length <= CHUNK_CHAR_LIMIT) {
      current = paragraph;
    } else {
      for (let index = 0; index < paragraph.length; index += CHUNK_CHAR_LIMIT) chunks.push(paragraph.slice(index, index + CHUNK_CHAR_LIMIT));
      current = "";
    }
  }
  if (current) chunks.push(current);
  return chunks;
}

async function replaceManualChunks(input: { companyId: string; equipmentId: string; manualId: string; manualText: string | null }) {
  await db.delete(equipmentManualChunks).where(eq(equipmentManualChunks.manualId, input.manualId));
  if (!input.manualText) return;
  const chunks = splitManualText(input.manualText);
  if (!chunks.length) return;
  await db.insert(equipmentManualChunks).values(chunks.map((chunkText, index) => ({ manualId: input.manualId, companyId: input.companyId, equipmentId: input.equipmentId, chunkText, sortOrder: index + 1 })));
}

async function syncEquipmentManualContext(input: { companyId: string; equipmentId: string; manualUrl: string | null; manualText: string | null }) {
  await db.update(equipmentAssets).set({ manualUrl: input.manualUrl, manualText: input.manualText, updatedAt: new Date() }).where(and(eq(equipmentAssets.id, input.equipmentId), eq(equipmentAssets.companyId, input.companyId)));
}

function sourceUrlFrom(input: { manualUrl?: string | null; asset?: UploadAssetResult | null }) {
  return input.asset?.secureUrl ?? input.asset?.url ?? input.manualUrl ?? null;
}

function isPdfSource(mimeType?: string | null, fileName?: string | null) {
  return mimeType === PDF_MIME_TYPE || Boolean(fileName?.toLowerCase().endsWith(".pdf"));
}

async function extractPdfTextFromBuffer(buffer: Buffer) {
  const parser = new PDFParse({ data: buffer });
  try {
    const result = await parser.getText();
    return normalizeManualText(result.text);
  } finally {
    await parser.destroy().catch(() => undefined);
  }
}

async function extractManualTextFromSource(sourceFile?: ManualSourceFile) {
  if (!sourceFile || !isPdfSource(sourceFile.mimeType, sourceFile.originalName)) return null;
  return extractPdfTextFromBuffer(sourceFile.buffer);
}

async function extractManualTextFromUrl(manualUrl: string, mimeType?: string | null) {
  try {
    const response = await fetch(manualUrl);
    if (!response.ok) return null;
    const contentType = response.headers.get("content-type");
    const isKnownNonPdf = contentType && !contentType.includes("pdf") && !contentType.includes("octet-stream") && !isPdfSource(mimeType, manualUrl);
    if (isKnownNonPdf) return null;
    return extractPdfTextFromBuffer(Buffer.from(await response.arrayBuffer()));
  } catch {
    return null;
  }
}

async function completeManualContext(input: ManualContextExtractionInput & { manualText: string }) {
  await db.update(equipmentManuals).set({ status: "READY", extractedText: input.manualText, updatedAt: new Date() }).where(and(eq(equipmentManuals.id, input.manualId), eq(equipmentManuals.companyId, input.companyId)));
  await replaceManualChunks({ companyId: input.companyId, equipmentId: input.equipmentId, manualId: input.manualId, manualText: input.manualText });
  await syncEquipmentManualContext({ companyId: input.companyId, equipmentId: input.equipmentId, manualUrl: input.manualUrl, manualText: input.manualText });
}

async function markManualExtractionFailed(input: Pick<ManualContextExtractionInput, "companyId" | "manualId">) {
  await db.update(equipmentManuals).set({ status: "FAILED", updatedAt: new Date() }).where(and(eq(equipmentManuals.id, input.manualId), eq(equipmentManuals.companyId, input.companyId)));
}

function queueManualContextExtraction(input: ManualContextExtractionInput) {
  setTimeout(() => {
    void extractManualTextFromUrl(input.manualUrl, input.mimeType)
      .then(async (manualText) => {
        if (!manualText) {
          await markManualExtractionFailed(input);
          return;
        }
        await completeManualContext({ ...input, manualText });
      })
      .catch(async () => markManualExtractionFailed(input));
  }, 0);
}

function needsManualExtraction(input: { status: string; extractedText: string | null; fileUrl: string | null }) {
  return Boolean(input.fileUrl) && (input.status === "PROCESSING" || !input.extractedText || input.extractedText.includes(SEED_CONTEXT_MARKER));
}

async function ensureManualContextExtracted(input: ManualContextExtractionInput & { status: string; extractedText: string | null }) {
  if (!needsManualExtraction({ status: input.status, extractedText: input.extractedText, fileUrl: input.manualUrl })) return null;
  const manualText = await extractManualTextFromUrl(input.manualUrl, input.mimeType);
  if (!manualText) {
    if (input.status === "PROCESSING") await markManualExtractionFailed(input);
    return null;
  }
  await completeManualContext({ ...input, manualText });
  return manualText;
}

function manualFileNameFrom(asset?: UploadAssetResult | null) {
  return asset?.fileName ?? (asset ? asset.key.split("/").at(-1) ?? null : null);
}

export async function listEquipmentManuals(input: ListEquipmentManualsInput) {
  const where = buildManualFilter(input);
  const [{ totalItems }] = await db.select({ totalItems: count() }).from(equipmentManuals).innerJoin(equipmentAssets, eq(equipmentManuals.equipmentId, equipmentAssets.id)).where(where);
  const pagination = buildPagination({ page: input.page, limit: input.limit, totalItems });
  const rows = await db
    .select({ id: equipmentManuals.id, equipmentId: equipmentManuals.equipmentId, title: equipmentManuals.title, fileUrl: equipmentManuals.fileUrl, fileKey: equipmentManuals.fileKey, fileName: equipmentManuals.fileName, mimeType: equipmentManuals.mimeType, fileSize: equipmentManuals.fileSize, status: equipmentManuals.status, extractedText: equipmentManuals.extractedText, createdAt: equipmentManuals.createdAt, updatedAt: equipmentManuals.updatedAt, equipment: { id: equipmentAssets.id, equipmentCode: equipmentAssets.equipmentCode, name: equipmentAssets.name } })
    .from(equipmentManuals)
    .innerJoin(equipmentAssets, eq(equipmentManuals.equipmentId, equipmentAssets.id))
    .where(where)
    .orderBy(desc(equipmentManuals.updatedAt))
    .limit(pagination.limit)
    .offset(pagination.offset);

  for (const row of rows) {
    const manualText = await ensureManualContextExtracted({ companyId: input.companyId, equipmentId: row.equipmentId, manualId: row.id, manualUrl: row.fileUrl ?? "", mimeType: row.mimeType, status: row.status, extractedText: row.extractedText });
    if (manualText) {
      row.status = "READY";
      row.extractedText = manualText;
      row.updatedAt = new Date();
    } else if (row.status === "PROCESSING" && row.fileUrl) {
      row.status = "FAILED";
      row.updatedAt = new Date();
    }
  }

  return { items: rows, pagination };
}

export async function getEquipmentManual(companyId: string, manualId: string) {
  const [manual] = await db
    .select({ id: equipmentManuals.id, equipmentId: equipmentManuals.equipmentId, title: equipmentManuals.title, fileUrl: equipmentManuals.fileUrl, fileKey: equipmentManuals.fileKey, fileName: equipmentManuals.fileName, mimeType: equipmentManuals.mimeType, fileSize: equipmentManuals.fileSize, status: equipmentManuals.status, extractedText: equipmentManuals.extractedText, createdAt: equipmentManuals.createdAt, updatedAt: equipmentManuals.updatedAt, equipment: { id: equipmentAssets.id, equipmentCode: equipmentAssets.equipmentCode, name: equipmentAssets.name } })
    .from(equipmentManuals)
    .innerJoin(equipmentAssets, eq(equipmentManuals.equipmentId, equipmentAssets.id))
    .where(and(eq(equipmentManuals.id, manualId), eq(equipmentManuals.companyId, companyId)))
    .limit(1);
  if (!manual) throw new AppError({ message: "Equipment manual not found.", statusCode: HTTP_STATUS.NOT_FOUND, errorCode: ERROR_CODES.NOT_FOUND });
  const manualText = await ensureManualContextExtracted({ companyId, equipmentId: manual.equipmentId, manualId: manual.id, manualUrl: manual.fileUrl ?? "", mimeType: manual.mimeType, status: manual.status, extractedText: manual.extractedText });
  if (manualText) {
    manual.status = "READY";
    manual.extractedText = manualText;
    manual.updatedAt = new Date();
  } else if (manual.status === "PROCESSING" && manual.fileUrl) {
    manual.status = "FAILED";
    manual.updatedAt = new Date();
  }
  const chunks = await db.select({ id: equipmentManualChunks.id, pageNumber: equipmentManualChunks.pageNumber, sectionTitle: equipmentManualChunks.sectionTitle, chunkText: equipmentManualChunks.chunkText, sortOrder: equipmentManualChunks.sortOrder }).from(equipmentManualChunks).where(eq(equipmentManualChunks.manualId, manual.id)).orderBy(asc(equipmentManualChunks.sortOrder));
  return { ...manual, chunks };
}

export async function createEquipmentManual(input: CreateEquipmentManualInput, asset?: UploadAssetResult | null, sourceFile?: ManualSourceFile) {
  await ensureEquipment(input.companyId, input.equipmentId);
  const submittedManualText = normalizeManualText(input.manualText);
  const extractedManualText = submittedManualText ?? (await extractManualTextFromSource(sourceFile));
  const fileUrl = sourceUrlFrom({ manualUrl: input.manualUrl, asset });
  if (!fileUrl && !extractedManualText) throw new AppError({ message: "Add a manual file, manual URL, or manual context text.", statusCode: HTTP_STATUS.BAD_REQUEST, errorCode: ERROR_CODES.VALIDATION_ERROR });
  const fileName = manualFileNameFrom(asset);
  const mimeType = asset?.mimeType ?? sourceFile?.mimeType ?? null;
  const [created] = await db.insert(equipmentManuals).values({ companyId: input.companyId, equipmentId: input.equipmentId, createdById: input.createdById ?? null, title: sanitizeString(input.title), fileUrl, fileKey: asset?.key ?? null, fileName, mimeType, fileSize: asset?.bytes ?? sourceFile?.buffer.length ?? null, status: input.status ?? (extractedManualText ? "READY" : "PROCESSING"), extractedText: extractedManualText, updatedAt: new Date() }).returning({ id: equipmentManuals.id });
  await replaceManualChunks({ companyId: input.companyId, equipmentId: input.equipmentId, manualId: created.id, manualText: extractedManualText });
  await syncEquipmentManualContext({ companyId: input.companyId, equipmentId: input.equipmentId, manualUrl: fileUrl, manualText: extractedManualText });
  if (!extractedManualText && fileUrl) queueManualContextExtraction({ companyId: input.companyId, equipmentId: input.equipmentId, manualId: created.id, manualUrl: fileUrl, mimeType });
  return getEquipmentManual(input.companyId, created.id);
}

export async function updateEquipmentManual(companyId: string, manualId: string, input: UpdateEquipmentManualInput, asset?: UploadAssetResult | null, sourceFile?: ManualSourceFile) {
  const existing = await ensureManual(companyId, manualId);
  const equipmentId = input.equipmentId ?? existing.equipmentId;
  await ensureEquipment(companyId, equipmentId);
  const submittedManualText = input.manualText === undefined ? undefined : normalizeManualText(input.manualText);
  const extractedFromFile = submittedManualText === undefined ? await extractManualTextFromSource(sourceFile) : null;
  const manualText = submittedManualText !== undefined ? submittedManualText : extractedFromFile ?? existing.extractedText;
  const fileUrl = sourceUrlFrom({ manualUrl: input.manualUrl === undefined ? existing.fileUrl : input.manualUrl, asset });
  if (!fileUrl && !manualText) throw new AppError({ message: "Add a manual file, manual URL, or manual context text.", statusCode: HTTP_STATUS.BAD_REQUEST, errorCode: ERROR_CODES.VALIDATION_ERROR });
  const mimeType = asset?.mimeType ?? sourceFile?.mimeType ?? existing.mimeType;
  await db.update(equipmentManuals).set({ ...(input.equipmentId !== undefined ? { equipmentId } : {}), ...(input.title !== undefined ? { title: sanitizeString(input.title) } : {}), fileUrl, ...(asset ? { fileKey: asset.key, fileName: manualFileNameFrom(asset), mimeType, fileSize: asset.bytes } : {}), ...(input.status !== undefined ? { status: input.status } : manualText ? { status: "READY" } : { status: "PROCESSING" }), extractedText: manualText, updatedAt: new Date() }).where(and(eq(equipmentManuals.id, manualId), eq(equipmentManuals.companyId, companyId)));
  await replaceManualChunks({ companyId, equipmentId, manualId, manualText });
  await syncEquipmentManualContext({ companyId, equipmentId, manualUrl: fileUrl, manualText });
  if (!manualText && fileUrl) queueManualContextExtraction({ companyId, equipmentId, manualId, manualUrl: fileUrl, mimeType });
  return getEquipmentManual(companyId, manualId);
}

export async function deleteEquipmentManual(companyId: string, manualId: string) {
  const existing = await ensureManual(companyId, manualId);
  await db.delete(equipmentManuals).where(and(eq(equipmentManuals.id, manualId), eq(equipmentManuals.companyId, companyId)));
  const [latest] = await db.select({ fileUrl: equipmentManuals.fileUrl, extractedText: equipmentManuals.extractedText }).from(equipmentManuals).where(and(eq(equipmentManuals.companyId, companyId), eq(equipmentManuals.equipmentId, existing.equipmentId))).orderBy(desc(equipmentManuals.updatedAt)).limit(1);
  await syncEquipmentManualContext({ companyId, equipmentId: existing.equipmentId, manualUrl: latest?.fileUrl ?? null, manualText: latest?.extractedText ?? null });
  return { id: manualId };
}