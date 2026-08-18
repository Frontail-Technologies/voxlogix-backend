import { and, asc, count, eq, gte, inArray, lte, sql } from "drizzle-orm";

import { db } from "@/db";
import {
  admins,
  companies,
  companyAccessSettings,
  equipmentAssets,
  logAttachments,
  meterCounterReadings,
  measuringPointReadings,
  moduleTypes,
  modules,
  operationalLogs,
} from "@/db/schema";
import type {
  OutputReportContext,
  OutputReportDataset,
  OutputReportSummary,
  ReportRange,
  SheetRow,
} from "@/modules/reports/output-report.types";
import { USER_ROLES, type UserRole } from "@/shared/constants";
import { AppError } from "@/shared/errors/app-error";
import { ERROR_CODES } from "@/shared/errors/error-codes";
import { HTTP_STATUS } from "@/shared/errors/http-status";

type ResolveCompanyInput = {
  role?: string;
  sessionCompanyId?: string;
  requestedCompanyId?: string;
  requireExport?: boolean;
};

type OperationalReportRow = {
  id: string;
  logNumber: string;
  moduleType: string;
  title: string;
  description: string | null;
  issueCategory: string | null;
  severity: string;
  status: string;
  downtimeMinutes: number;
  extractedFields: Record<string, unknown>;
  createdAt: Date;
  equipment: {
    equipmentCode: string;
    name: string;
    category: string;
    section: string;
    subLocation: string;
    criticality: string;
  } | null;
  createdBy: { fullName: string } | null;
  module: {
    name: string | null;
    slug: string | null;
    type: string | null;
  } | null;
};

type ClassifiedModule = "equipment" | "safety" | "shift" | "kaizen" | null;

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const CLOSED_STATUS_VALUES = new Set(["resolved", "closed", "completed", "done", "implemented", "rejected"]);

export function parseReportRange(fromDate: string, toDate: string): ReportRange {
  const from = new Date(`${fromDate}T00:00:00.000`);
  const to = new Date(`${toDate}T23:59:59.999`);

  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || from > to) {
    throw new AppError({
      message: "From Date must be before or equal to To Date.",
      statusCode: HTTP_STATUS.BAD_REQUEST,
      errorCode: ERROR_CODES.VALIDATION_ERROR,
      errors: [{ field: "fromDate", message: "From Date must be before or equal to To Date." }],
    });
  }

  return { fromDate, toDate, from, to };
}

export async function resolveOutputReportCompanyId(input: ResolveCompanyInput) {
  const role = input.role as UserRole | undefined;
  const companyId =
    role === USER_ROLES.MASTER
      ? input.requestedCompanyId ?? input.sessionCompanyId
      : input.sessionCompanyId;

  if (!companyId) {
    throw new AppError({
      message: "Company is required for this report.",
      statusCode: HTTP_STATUS.BAD_REQUEST,
      errorCode: ERROR_CODES.VALIDATION_ERROR,
      errors: [{ field: "companyId", message: "Company is required for this report." }],
    });
  }

  if (role !== USER_ROLES.MASTER && input.requestedCompanyId && input.requestedCompanyId !== input.sessionCompanyId) {
    throw new AppError({
      message: "You do not have permission to export another company's report.",
      statusCode: HTTP_STATUS.FORBIDDEN,
      errorCode: ERROR_CODES.FORBIDDEN,
    });
  }

  const [access] = await db
    .select({
      reportsEnabled: companyAccessSettings.reportsEnabled,
      exportEnabled: companyAccessSettings.exportEnabled,
    })
    .from(companyAccessSettings)
    .where(eq(companyAccessSettings.companyId, companyId))
    .limit(1);

  if (access?.reportsEnabled === false) {
    throw new AppError({
      message: "Reports are disabled for this company.",
      statusCode: HTTP_STATUS.FORBIDDEN,
      errorCode: ERROR_CODES.FORBIDDEN,
    });
  }

  if (input.requireExport && access?.exportEnabled === false) {
    throw new AppError({
      message: "Export is disabled for this company.",
      statusCode: HTTP_STATUS.FORBIDDEN,
      errorCode: ERROR_CODES.FORBIDDEN,
    });
  }

  return companyId;
}

export async function getOutputReportSummary(input: OutputReportContext): Promise<OutputReportSummary> {
  const dataset = await buildOutputReportDataset(input);
  const counts = {
    equipmentLog: dataset.equipmentRows.length,
    safetyLog: dataset.safetyRows.length,
    measuringPointsLog: dataset.measuringPointRows.length,
    meterCountersLog: dataset.meterCounterRows.length,
    shiftLog: dataset.shiftRows.length,
    kaizenLog: dataset.kaizenRows.length,
    masterLog: dataset.masterRows.length,
    total: dataset.masterRows.length,
  };

  return {
    company: dataset.company,
    range: { fromDate: input.fromDate, toDate: input.toDate },
    counts,
    hasRecords: counts.total > 0,
  };
}

export async function buildOutputReportDataset(input: OutputReportContext): Promise<OutputReportDataset> {
  const range = parseReportRange(input.fromDate, input.toDate);
  const [company] = await db
    .select({ id: companies.id, name: companies.name, phone: companies.ownerPhone })
    .from(companies)
    .where(eq(companies.id, input.companyId))
    .limit(1);

  if (!company) {
    throw new AppError({
      message: "Company not found.",
      statusCode: HTTP_STATUS.NOT_FOUND,
      errorCode: ERROR_CODES.NOT_FOUND,
    });
  }

  const operationalRows = await getOperationalRows(input.companyId, range);
  const attachmentCounts = await getAttachmentCounts(operationalRows.map((row) => row.id));
  const equipmentRows = getEquipmentReportRows(operationalRows, attachmentCounts);
  const safetyRows = getSafetyReportRows(operationalRows, attachmentCounts, range.to);
  const measuringPointRows = await getMeasuringPointReportRows(input.companyId, range);
  const meterCounterRows = await getMeterCounterReportRows(input.companyId, range);
  const shiftRows = getShiftReportRows(operationalRows, attachmentCounts);
  const kaizenRows = getKaizenReportRows(operationalRows, attachmentCounts, range.to);
  const masterRows = buildMasterLogRows({
    equipmentRows,
    safetyRows,
    measuringPointRows,
    meterCounterRows,
    shiftRows,
    kaizenRows,
  });

  return {
    company,
    range,
    generatedAt: new Date(),
    equipmentRows,
    safetyRows,
    measuringPointRows,
    meterCounterRows,
    shiftRows,
    kaizenRows,
    masterRows,
  };
}

async function getOperationalRows(companyId: string, range: ReportRange): Promise<OperationalReportRow[]> {
  return db
    .select({
      id: operationalLogs.id,
      logNumber: operationalLogs.logNumber,
      moduleType: operationalLogs.moduleType,
      title: operationalLogs.title,
      description: operationalLogs.description,
      issueCategory: operationalLogs.issueCategory,
      severity: operationalLogs.severity,
      status: operationalLogs.status,
      downtimeMinutes: operationalLogs.downtimeMinutes,
      extractedFields: operationalLogs.extractedFields,
      createdAt: operationalLogs.createdAt,
      equipment: {
        equipmentCode: equipmentAssets.equipmentCode,
        name: equipmentAssets.name,
        category: equipmentAssets.category,
        section: equipmentAssets.section,
        subLocation: equipmentAssets.subLocation,
        criticality: equipmentAssets.criticality,
      },
      createdBy: { fullName: admins.fullName },
      module: {
        name: modules.name,
        slug: modules.slug,
        type: moduleTypes.name,
      },
    })
    .from(operationalLogs)
    .leftJoin(equipmentAssets, eq(operationalLogs.equipmentId, equipmentAssets.id))
    .leftJoin(admins, eq(operationalLogs.createdById, admins.id))
    .leftJoin(modules, eq(operationalLogs.moduleId, modules.id))
    .leftJoin(moduleTypes, eq(modules.moduleTypeId, moduleTypes.id))
    .where(and(eq(operationalLogs.companyId, companyId), gte(operationalLogs.createdAt, range.from), lte(operationalLogs.createdAt, range.to)))
    .orderBy(asc(operationalLogs.createdAt), asc(operationalLogs.logNumber));
}

async function getAttachmentCounts(logIds: string[]) {
  if (logIds.length === 0) return new Map<string, number>();

  const rows = await db
    .select({ logId: logAttachments.logId, total: count() })
    .from(logAttachments)
    .where(inArray(logAttachments.logId, logIds))
    .groupBy(logAttachments.logId);

  return new Map(rows.map((row) => [row.logId, Number(row.total)]));
}

export function getEquipmentReportRows(rows: OperationalReportRow[], attachmentCounts: Map<string, number>): SheetRow[] {
  const equipmentRows = rows
    .filter((row) => classifyOperationalLog(row) === "equipment")
    .map((row) => {
      const fields = row.extractedFields ?? {};
      return {
        "Log ID": moduleLogId("EQ", row.logNumber),
        "Reported Date": row.createdAt,
        "Reported Time": row.createdAt,
        Title: row.title,
        "Equipment ID": row.equipment?.equipmentCode ?? blank(),
        "Equipment Name": row.equipment?.name ?? blank(),
        Section: pickString(fields, ["section"]) ?? row.equipment?.section ?? blank(),
        "Sub Location": pickString(fields, ["subLocation", "sub_location"]) ?? row.equipment?.subLocation ?? blank(),
        "Equipment Category": pickString(fields, ["equipmentCategory", "equipment_category"]) ?? row.equipment?.category ?? blank(),
        Criticality: label(row.equipment?.criticality) ?? blank(),
        "Issue Category": row.issueCategory ?? pickString(fields, ["issueCategory", "issue_category", "category", "issue"]) ?? blank(),
        "Equipment Function": pickString(fields, ["equipmentFunction", "equipment_function", "function"]) ?? blank(),
        "Failure Mode": pickString(fields, ["failureMode", "failure_mode"]) ?? blank(),
        "Maintenance Type": pickString(fields, ["maintenanceType", "maintenance_type"]) ?? blank(),
        "Root Cause": pickString(fields, ["rootCause", "root_cause"]) ?? blank(),
        "Action Taken": pickString(fields, ["actionTaken", "action_taken", "action"]) ?? blank(),
        "Spare Part/Consumable Ref": pickString(fields, ["sparePartRef", "spare_part_ref", "sparePartConsumableRef"]) ?? blank(),
        "Issue Status": label(row.status),
        Severity: label(row.severity),
        "Production Impact": pickString(fields, ["productionImpact", "production_impact"]) ?? blank(),
        "Downtime Hours": minutesToHours(row.downtimeMinutes),
        "Attachments Count": attachmentCounts.get(row.id) ?? 0,
        "Reported By": row.createdBy?.fullName ?? blank(),
        "Repeat Failure Flag": "First Occurrence",
        "Days Since Last Failure (same Equipment)": "First Log",
        __reportedAt: row.createdAt,
      };
    });

  const comboCounts = new Map<string, number>();
  for (const row of equipmentRows) {
    const key = [row["Equipment ID"], row["Equipment Function"], row["Failure Mode"]].join("|").toLowerCase();
    comboCounts.set(key, (comboCounts.get(key) ?? 0) + 1);
  }

  const previousByEquipment = new Map<string, Date>();
  return equipmentRows.map((row) => {
    const reportedAt = row.__reportedAt as Date;
    const equipmentId = String(row["Equipment ID"] ?? "");
    const comboKey = [row["Equipment ID"], row["Equipment Function"], row["Failure Mode"]].join("|").toLowerCase();
    const previous = previousByEquipment.get(equipmentId);
    previousByEquipment.set(equipmentId, reportedAt);
    const { __reportedAt: _reportedAt, ...reportRow } = row;
    void _reportedAt;

    return {
      ...reportRow,
      "Repeat Failure Flag": (comboCounts.get(comboKey) ?? 0) > 1 ? "Repeat" : "First Occurrence",
      "Days Since Last Failure (same Equipment)": previous ? daysBetween(previous, reportedAt) : "First Log",
    };
  });
}

export function getSafetyReportRows(
  rows: OperationalReportRow[],
  attachmentCounts: Map<string, number>,
  generatedAt: Date,
): SheetRow[] {
  return rows.filter((row) => classifyOperationalLog(row) === "safety").map((row) => {
    const fields = row.extractedFields ?? {};
    return {
      "Log ID": moduleLogId("SF", row.logNumber),
      "Reported Date": row.createdAt,
      "Reported Time": row.createdAt,
      Title: row.title,
      "Incident Category": row.issueCategory ?? pickString(fields, ["incidentCategory", "safetyCategory", "category"]) ?? blank(),
      Section: pickString(fields, ["section", "department"]) ?? blank(),
      Location: pickString(fields, ["location", "subLocation", "sub_location"]) ?? blank(),
      "Incident Type": pickString(fields, ["incidentType", "incident_type"]) ?? blank(),
      "Action Taken": pickString(fields, ["actionTaken", "action_taken", "action"]) ?? blank(),
      "Issue Status": label(row.status),
      Severity: label(row.severity),
      "Requires PPE": yesNo(pickValue(fields, ["requiresPpe", "requires_ppe"])),
      "PPE Type": pickString(fields, ["ppeType", "ppe_type"]) ?? blank(),
      "Reportable (Factories Act)": yesNo(pickValue(fields, ["reportableFactoriesAct", "reportable", "factoriesAct"])),
      "Immediate Action Required": yesNo(pickValue(fields, ["immediateActionRequired", "immediate_action_required"])),
      "Attachments Count": attachmentCounts.get(row.id) ?? 0,
      "Reported By": row.createdBy?.fullName ?? blank(),
      "Days Open (if not Resolved)": isClosedStatus(row.status) ? "Closed" : daysBetween(row.createdAt, generatedAt),
    };
  });
}

export async function getMeasuringPointReportRows(companyId: string, range: ReportRange): Promise<SheetRow[]> {
  const rows = await db
    .select({
      reportLogId: measuringPointReadings.reportLogId,
      pointCode: measuringPointReadings.pointCode,
      equipmentCode: measuringPointReadings.equipmentCodeSnapshot,
      equipmentName: measuringPointReadings.equipmentNameSnapshot,
      measurementName: measuringPointReadings.measurementNameSnapshot,
      measurementUnit: measuringPointReadings.measurementUnitSnapshot,
      measuredValue: measuringPointReadings.measuredValue,
      targetValue: measuringPointReadings.targetValueSnapshot,
      lowerLimit: measuringPointReadings.lowerLimitSnapshot,
      upperLimit: measuringPointReadings.upperLimitSnapshot,
      deviationPercent: measuringPointReadings.deviationPercent,
      measurementStatus: measuringPointReadings.measurementStatus,
      severity: measuringPointReadings.alertSeveritySnapshot,
      reportedAt: measuringPointReadings.reportedAt,
      equipment: { section: equipmentAssets.section },
      reportedBy: { fullName: admins.fullName },
    })
    .from(measuringPointReadings)
    .leftJoin(equipmentAssets, eq(measuringPointReadings.equipmentId, equipmentAssets.id))
    .leftJoin(admins, eq(measuringPointReadings.reportedById, admins.id))
    .where(and(eq(measuringPointReadings.companyId, companyId), gte(measuringPointReadings.reportedAt, range.from), lte(measuringPointReadings.reportedAt, range.to)))
    .orderBy(asc(measuringPointReadings.reportedAt), asc(measuringPointReadings.reportLogId));

  return rows.map((row) => ({
    "Log ID": row.reportLogId,
    "Reported Date": row.reportedAt,
    "Reported Time": row.reportedAt,
    Title: `${row.measurementName} reading for ${row.equipmentName ?? "equipment"}`,
    "Point ID": row.pointCode,
    "Equipment ID": row.equipmentCode ?? blank(),
    "Equipment Name": row.equipmentName ?? blank(),
    Section: row.equipment?.section ?? blank(),
    "Measurement Name": row.measurementName,
    "Measurement UoM": row.measurementUnit,
    "Measured Value": reportNumber(row.measuredValue),
    "Target Value": reportNumber(row.targetValue),
    "Lower Limit": reportNumber(row.lowerLimit),
    "Upper Limit": reportNumber(row.upperLimit),
    Severity: label(row.severity),
    "Attachments Count": 0,
    "Reported By": row.reportedBy?.fullName ?? blank(),
    "Out of Limit Flag": row.measurementStatus === "OUT_OF_LIMIT" ? "OUT OF LIMIT" : "Normal",
    "Deviation % (vs Target)": percentNumber(row.deviationPercent),
  }));
}

export async function getMeterCounterReportRows(companyId: string, range: ReportRange): Promise<SheetRow[]> {
  const rows = await db
    .select({
      reportLogId: meterCounterReadings.reportLogId,
      counterCode: meterCounterReadings.counterCode,
      equipmentCode: meterCounterReadings.equipmentCodeSnapshot,
      location: meterCounterReadings.locationSnapshot,
      counterName: meterCounterReadings.counterNameSnapshot,
      meterType: meterCounterReadings.meterTypeSnapshot,
      counterUnit: meterCounterReadings.counterUnitSnapshot,
      previousReading: meterCounterReadings.previousReading,
      currentReading: meterCounterReadings.currentReading,
      expectedConsumptionForPeriod: meterCounterReadings.expectedConsumptionForPeriod,
      previousReadingAt: meterCounterReadings.previousReadingAt,
      consumptionDelta: meterCounterReadings.consumptionDelta,
      deviationPercent: meterCounterReadings.deviationPercent,
      counterStatus: meterCounterReadings.counterStatus,
      reportedAt: meterCounterReadings.reportedAt,
      reportedBy: { fullName: admins.fullName },
    })
    .from(meterCounterReadings)
    .leftJoin(admins, eq(meterCounterReadings.reportedById, admins.id))
    .where(and(eq(meterCounterReadings.companyId, companyId), gte(meterCounterReadings.reportedAt, range.from), lte(meterCounterReadings.reportedAt, range.to)))
    .orderBy(asc(meterCounterReadings.reportedAt), asc(meterCounterReadings.reportLogId));

  return rows.map((row) => ({
    "Log ID": row.reportLogId,
    "Reported Date": row.reportedAt,
    "Reported Time": row.reportedAt,
    Title: `${row.counterName} reading`,
    "Counter ID": row.counterCode,
    "Equipment ID": row.equipmentCode ?? "NA",
    Location: row.location ?? blank(),
    "Counter Name": row.counterName,
    "Meter Type": row.meterType,
    "Counter UoM": row.counterUnit,
    "Previous Reading": reportNumber(row.previousReading),
    "Current Reading": reportNumber(row.currentReading),
    "Expected Consumption (for period)": reportNumber(row.expectedConsumptionForPeriod),
    "Days Since Last Reading": row.previousReadingAt ? daysBetween(row.previousReadingAt, row.reportedAt) : null,
    "Attachments Count": 0,
    "Reported By": row.reportedBy?.fullName ?? blank(),
    "Consumption Delta": reportNumber(row.consumptionDelta),
    "Deviation % (vs Expected)": percentNumber(row.deviationPercent),
    "Deviation Flag": row.counterStatus === "HIGH_DEVIATION" ? "HIGH DEVIATION" : "Normal",
  }));
}

export function getShiftReportRows(rows: OperationalReportRow[], attachmentCounts: Map<string, number>): SheetRow[] {
  return rows.filter((row) => classifyOperationalLog(row) === "shift").map((row) => {
    const fields = row.extractedFields ?? {};
    return {
      "Log ID": moduleLogId("SH", row.logNumber),
      "Reported Date": row.createdAt,
      "Reported Time": row.createdAt,
      Shift: pickString(fields, ["shift", "shiftName", "shift_name"]) ?? blank(),
      Title: row.title,
      Description: row.description ?? pickString(fields, ["description"]) ?? blank(),
      "Equipment ID": row.equipment?.equipmentCode ?? pickString(fields, ["equipmentId", "equipment_id"]) ?? "NA",
      Location: pickString(fields, ["location", "subLocation", "sub_location"]) ?? row.equipment?.subLocation ?? blank(),
      "Issue Status": label(row.status),
      Severity: label(row.severity) ?? "NA",
      "Spare Part/Consumables Ref": pickString(fields, ["sparePartRef", "spare_part_ref", "sparePartConsumableRef"]) ?? blank(),
      "Time Duration Hours": reportNumber(pickValue(fields, ["timeDurationHours", "time_duration_hours", "durationHours"])) ?? null,
      "Downtime Hours": minutesToHours(row.downtimeMinutes),
      "Attachments Count": attachmentCounts.get(row.id) ?? 0,
      "Reported By": row.createdBy?.fullName ?? blank(),
    };
  });
}

export function getKaizenReportRows(
  rows: OperationalReportRow[],
  attachmentCounts: Map<string, number>,
  generatedAt: Date,
): SheetRow[] {
  return rows.filter((row) => classifyOperationalLog(row) === "kaizen").map((row) => {
    const fields = row.extractedFields ?? {};
    return {
      "Log ID": moduleLogId("KZ", row.logNumber),
      "Reported Date": row.createdAt,
      "Reported Time": row.createdAt,
      Title: row.title,
      Description: row.description ?? pickString(fields, ["description"]) ?? blank(),
      "Kaizen Category": row.issueCategory ?? pickString(fields, ["kaizenCategory", "kaizen_category", "category"]) ?? blank(),
      Department: pickString(fields, ["department"]) ?? blank(),
      Location: pickString(fields, ["location", "subLocation", "sub_location"]) ?? blank(),
      "Expected Benefit": pickString(fields, ["expectedBenefit", "expected_benefit", "benefit"]) ?? blank(),
      Status: label(row.status),
      "Attachments Count": attachmentCounts.get(row.id) ?? 0,
      "Reported By": row.createdBy?.fullName ?? blank(),
      "Days Open": isClosedStatus(row.status) ? "Closed/Final" : daysBetween(row.createdAt, generatedAt),
    };
  });
}

export function buildMasterLogRows(input: {
  equipmentRows: SheetRow[];
  safetyRows: SheetRow[];
  measuringPointRows: SheetRow[];
  meterCounterRows: SheetRow[];
  shiftRows: SheetRow[];
  kaizenRows: SheetRow[];
}): SheetRow[] {
  const rows = [
    ...input.equipmentRows.map((row) => masterRow("Equipment", row, {
      section: row.Section,
      location: row["Sub Location"],
      equipmentId: row["Equipment ID"],
      category: row["Issue Category"],
      severity: row.Severity,
      status: row["Issue Status"],
      downtime: row["Downtime Hours"],
    })),
    ...input.safetyRows.map((row) => masterRow("Safety", row, {
      section: row.Section,
      location: row.Location,
      equipmentId: "NA",
      category: row["Incident Category"],
      severity: row.Severity,
      status: row["Issue Status"],
      downtime: 0,
    })),
    ...input.measuringPointRows.map((row) => masterRow("Measuring Point", row, {
      section: row.Section,
      location: row["Equipment Name"],
      equipmentId: row["Equipment ID"],
      category: row["Measurement Name"],
      severity: row.Severity,
      status: "NA",
      downtime: 0,
    })),
    ...input.meterCounterRows.map((row) => masterRow("Meter Counter", row, {
      section: row.Location,
      location: row.Location,
      equipmentId: row["Equipment ID"] ?? "NA",
      category: row["Counter Name"],
      severity: "NA",
      status: "NA",
      downtime: 0,
    })),
    ...input.shiftRows.map((row) => masterRow("Shift Log", row, {
      section: "NA",
      location: row.Location,
      equipmentId: row["Equipment ID"] ?? "NA",
      category: row.Shift,
      severity: row.Severity ?? "NA",
      status: row["Issue Status"],
      downtime: row["Downtime Hours"],
    })),
    ...input.kaizenRows.map((row) => masterRow("Kaizen", row, {
      section: row.Department,
      location: row.Location,
      equipmentId: "NA",
      category: row["Kaizen Category"],
      severity: "NA",
      status: row.Status,
      downtime: 0,
    })),
  ];

  return rows.sort((a, b) => {
    const aTime = a["Reported Date"] instanceof Date ? a["Reported Date"].getTime() : 0;
    const bTime = b["Reported Date"] instanceof Date ? b["Reported Date"].getTime() : 0;
    return aTime - bTime || String(a["Log ID"]).localeCompare(String(b["Log ID"]));
  });
}

function masterRow(
  logType: string,
  source: SheetRow,
  mapped: {
    section: SheetRow[string];
    location: SheetRow[string];
    equipmentId: SheetRow[string];
    category: SheetRow[string];
    severity: SheetRow[string];
    status: SheetRow[string];
    downtime: SheetRow[string];
  },
): SheetRow {
  const reportedDate = source["Reported Date"] as Date;
  return {
    "Log Type": logType,
    "Log ID": source["Log ID"],
    "Reported Date": reportedDate,
    "Reported Time": source["Reported Time"],
    Month: monthLabel(reportedDate),
    "Section/Department": mapped.section ?? "NA",
    Location: mapped.location ?? "NA",
    "Equipment ID": mapped.equipmentId ?? "NA",
    "Category/Type": mapped.category ?? "NA",
    Severity: mapped.severity ?? "NA",
    Status: mapped.status ?? "NA",
    "Downtime Hours": mapped.downtime ?? 0,
    "Reported By": source["Reported By"],
  };
}

function classifyOperationalLog(row: OperationalReportRow): ClassifiedModule {
  const fields = row.extractedFields ?? {};
  const readingType = String(pickValue(fields, ["readingType", "reading_type"]) ?? "").toLowerCase();
  if (readingType.includes("measuring") || readingType.includes("meter")) return null;

  const text = normalizeKey([row.moduleType, row.module?.name, row.module?.slug, row.module?.type].filter(Boolean).join(" "));
  if (text.includes("safety")) return "safety";
  if (text.includes("shift")) return "shift";
  if (text.includes("kaizen") || text.includes("suggestion")) return "kaizen";
  if (text.includes("equipment") && !text.includes("measurement") && !text.includes("meter")) return "equipment";
  return null;
}

function pickValue(fields: Record<string, unknown>, keys: string[]) {
  const normalizedKeys = new Set(keys.map(normalizeKey));
  for (const [key, value] of Object.entries(fields)) {
    if (normalizedKeys.has(normalizeKey(key))) return value;
  }
  return undefined;
}

function pickString(fields: Record<string, unknown>, keys: string[]) {
  const value = pickValue(fields, keys);
  if (value === null || value === undefined || value === "") return undefined;
  return String(value);
}

function normalizeKey(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function moduleLogId(prefix: string, logNumber: string) {
  if (logNumber.toUpperCase().startsWith(`${prefix}-`)) return logNumber;
  return `${prefix}-${logNumber.replace(/^LOG-/i, "")}`;
}

function label(value?: string | null) {
  if (!value) return "";
  return value
    .toLowerCase()
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function yesNo(value: unknown) {
  if (value === null || value === undefined || value === "") return blank();
  if (typeof value === "boolean") return value ? "Yes" : "No";
  const normalized = String(value).trim().toLowerCase();
  if (["true", "yes", "y", "1"].includes(normalized)) return "Yes";
  if (["false", "no", "n", "0"].includes(normalized)) return "No";
  return String(value);
}

function blank() {
  return "";
}

function reportNumber(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function percentNumber(value: unknown) {
  const parsed = reportNumber(value);
  return parsed === null ? null : parsed / 100;
}

function minutesToHours(minutes: number) {
  return Number((minutes / 60).toFixed(2));
}

function daysBetween(from: Date, to: Date) {
  return Math.max(0, Math.floor((startOfLocalDay(to).getTime() - startOfLocalDay(from).getTime()) / MS_PER_DAY));
}

function startOfLocalDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function isClosedStatus(status: string) {
  return CLOSED_STATUS_VALUES.has(status.toLowerCase().replace(/[_\s-]+/g, " "));
}

function monthLabel(date: Date) {
  return `${MONTHS[date.getMonth()]}-${date.getFullYear()}`;
}
