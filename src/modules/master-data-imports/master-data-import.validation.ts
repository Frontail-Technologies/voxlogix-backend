import { z } from "zod";

const MASTER_DATA_SHEET_KEYS = [
  "locations",
  "equipment",
  "issueCategories",
  "safety",
  "measuringPoints",
  "meterCounters",
  "users",
  "kaizen",
] as const;

// Rows here are exactly what preview returned, edited or not — the client never invents new
// column keys, so a permissive string-record is fine; every field the writers actually read
// is still validated (types/required-ness) inside the existing importX functions themselves.
const commitRowSchema = z.object({
  previewId: z.string().trim().min(1).max(200),
  values: z.record(z.string(), z.string().max(5000)),
});

const commitSheetSchema = z.object({
  key: z.enum(MASTER_DATA_SHEET_KEYS),
  // A generous cap, not a real-world expectation — this is abuse prevention, not a product
  // limit; a legitimate workbook is a few hundred rows per sheet at most.
  rows: z.array(commitRowSchema).max(5000),
});

export const commitMasterDataImportBodySchema = z.object({
  sheets: z.array(commitSheetSchema).max(MASTER_DATA_SHEET_KEYS.length),
});
