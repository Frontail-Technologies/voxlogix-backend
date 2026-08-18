export type ReportRange = {
  fromDate: string;
  toDate: string;
  from: Date;
  to: Date;
};

export type OutputReportContext = {
  companyId: string;
  fromDate: string;
  toDate: string;
};

export type SheetRow = Record<string, string | number | Date | null>;

export type OutputReportDataset = {
  company: {
    id: string;
    name: string;
    phone: string;
  };
  range: ReportRange;
  generatedAt: Date;
  equipmentRows: SheetRow[];
  safetyRows: SheetRow[];
  measuringPointRows: SheetRow[];
  meterCounterRows: SheetRow[];
  shiftRows: SheetRow[];
  kaizenRows: SheetRow[];
  masterRows: SheetRow[];
};

export type OutputReportSummary = {
  company: OutputReportDataset["company"];
  range: {
    fromDate: string;
    toDate: string;
  };
  counts: {
    equipmentLog: number;
    safetyLog: number;
    measuringPointsLog: number;
    meterCountersLog: number;
    shiftLog: number;
    kaizenLog: number;
    masterLog: number;
    total: number;
  };
  hasRecords: boolean;
};
