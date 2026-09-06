export type SheetImportSummary = {
  sheet: string;
  imported: number;
  created: number;
  updated: number;
  unchanged: number;
  skipped: number;
  errors: string[];
};

export type MasterDataImportResult = {
  fileName?: string;
  sheets: SheetImportSummary[];
};

// --- Two-phase preview/commit model ---
// Preview IDs are temporary, session-scoped identifiers for matching a reviewed row back to
// its original parsed row — they are never business IDs and are never persisted.

export type PreviewRowStatus = "accepted" | "rejected";

export type PreviewRowErrorCode =
  | "REQUIRED"
  | "DUPLICATE"
  | "INVALID_FORMAT"
  | "UNKNOWN_REFERENCE"
  | "MODULE_DISABLED";

export type PreviewRowError = {
  field: string;
  code: PreviewRowErrorCode;
  message: string;
};

export type PreviewRow = {
  previewId: string;
  status: PreviewRowStatus;
  originalRowNumber: number;
  values: Record<string, string>;
  errors: PreviewRowError[];
};

export type MasterDataSheetKey =
  | "locations"
  | "equipment"
  | "issueCategories"
  | "safety"
  | "measuringPoints"
  | "meterCounters"
  | "users"
  | "kaizen";

export type PreviewSheet = {
  key: MasterDataSheetKey;
  label: string;
  // SUPPORTED (VoxLogiX understands this sheet format) is implicit — this type only ever
  // represents sheets we recognize. ENABLED (this company's module access) is separate and
  // explicit below; a sheet can be supported+enabled, supported+disabled, or absent from the
  // workbook entirely (rows: []).
  moduleEnabled: boolean;
  // Which module gates this sheet, or null for core/shared sheets that are never gated.
  gatingModule: string | null;
  rows: PreviewRow[];
  counts: {
    total: number;
    accepted: number;
    rejected: number;
  };
};

export type MasterDataImportPreview = {
  fileName?: string;
  summary: {
    // Counts only ever reflect ENABLED/importable sheets — a disabled module's rows are out
    // of scope for this company, not "rejected", so they're excluded from every count here.
    total: number;
    accepted: number;
    rejected: number;
  };
  // Disabled-module sheets are omitted from this array entirely (see buildMasterDataImportPreview) —
  // the client never receives a sheet it can't import, so there's nothing to hide again on its side.
  sheets: PreviewSheet[];
  // How many sheets were parsed but left out of `sheets` above because their gating module
  // isn't enabled for this company. Purely informational; the UI shows at most a neutral,
  // non-naming note with it — never which modules those were.
  ignoredSheetCount: number;
};

export type CommitSheetInput = {
  key: MasterDataSheetKey;
  // Only the rows the reviewer chose to keep, with any edits already applied — a removed
  // row is simply absent, not a boolean flag, so a tampered payload can't smuggle it back in
  // by flipping a client-side "removed" property server-side never checks.
  rows: Array<{ previewId: string; values: Record<string, string> }>;
};

export type CommitMasterDataImportInput = {
  companyId: string;
  sheets: CommitSheetInput[];
};
