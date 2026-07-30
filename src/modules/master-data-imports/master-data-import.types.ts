export type SheetImportSummary = {
  sheet: string;
  imported: number;
  skipped: number;
  errors: string[];
};

export type MasterDataImportResult = {
  fileName?: string;
  sheets: SheetImportSummary[];
};
