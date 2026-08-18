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
