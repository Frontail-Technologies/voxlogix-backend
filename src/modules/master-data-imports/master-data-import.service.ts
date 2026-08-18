import { and, eq, sql } from "drizzle-orm";
import * as XLSX from "xlsx";

import { db } from "@/db";
import {
  admins,
  equipmentAssets,
  equipmentCategories,
  issueCategories,
  kaizenCategories,
  locations,
  measuringPoints,
  meterCounters,
  safetyReportingMasters,
} from "@/db/schema";
import type { MasterDataImportResult, SheetImportSummary } from "@/modules/master-data-imports/master-data-import.types";
import { USER_ROLES, USER_STATUS } from "@/shared/constants";
import { sanitizeNullableString, sanitizeString } from "@/shared/helpers/sanitize";
import { hashPassword } from "@/shared/security/password";

type Row = Record<string, string>;

const DEFAULT_TEMP_PASSWORD = "Voxlogix@123";

const SHEETS = {
  equipment: "Equipment Master",
  issueCategories: "Issue Categories",
  safety: "Safety Reporting",
  measuringPoints: "Measuring Points",
  meterCounters: "Meter Counters",
  users: "Users & Roles",
  kaizen: "Kaizen",
  locations: "Sections, Locations & Shift",
} as const;

function normalizeHeader(value: unknown) {
  return String(value ?? "")
    .trim()
    .replace(/\s+/g, " ")
    .toUpperCase();
}

function normalizeValue(value: unknown) {
  return String(value ?? "").trim();
}

function findWorksheet(workbook: XLSX.WorkBook, namePart: string) {
  const sheetName = workbook.SheetNames.find((name) => name.toLowerCase().includes(namePart.toLowerCase()));
  return sheetName ? { sheetName, sheet: workbook.Sheets[sheetName] } : null;
}

function readSheetRows(workbook: XLSX.WorkBook, namePart: string): { sheetName: string; rows: Row[] } {
  const found = findWorksheet(workbook, namePart);
  if (!found) return { sheetName: namePart, rows: [] };

  const matrix = XLSX.utils.sheet_to_json<unknown[]>(found.sheet, { header: 1, defval: "" });
  const headerRow = matrix[2] ?? [];
  const headers = headerRow.map(normalizeHeader);

  const rows = matrix.slice(4).map((row) => {
    const record: Row = {};
    headers.forEach((header, index) => {
      if (header) record[header] = normalizeValue(row[index]);
    });
    return record;
  });

  return {
    sheetName: found.sheetName,
    rows: rows.filter((row) => Object.values(row).some(Boolean)),
  };
}

function summary(sheet: string): SheetImportSummary {
  return { sheet, imported: 0, created: 0, updated: 0, unchanged: 0, skipped: 0, errors: [] };
}

function markCreated(result: SheetImportSummary) {
  result.created += 1;
  result.imported += 1;
}

function markUpdated(result: SheetImportSummary) {
  result.updated += 1;
  result.imported += 1;
}

function normalizedBusinessKey(valueText: string) {
  return valueText.trim().toLowerCase();
}

function duplicateBusinessIds(rows: Row[], header: string, result: SheetImportSummary) {
  const rowNumbersByKey = new Map<string, number[]>();

  rows.forEach((row, index) => {
    const raw = value(row, header);
    if (!raw) return;
    const key = normalizedBusinessKey(raw);
    rowNumbersByKey.set(key, [...(rowNumbersByKey.get(key) ?? []), index + 5]);
  });

  const duplicates = new Set<string>();
  for (const [key, rowNumbers] of rowNumbersByKey.entries()) {
    if (rowNumbers.length <= 1) continue;
    duplicates.add(key);
    result.errors.push(`${header} "${key}" appears multiple times in rows ${rowNumbers.join(", ")}. Duplicate rows were skipped.`);
  }

  return duplicates;
}

function value(row: Row, key: string) {
  return sanitizeNullableString(row[normalizeHeader(key)]) ?? "";
}

function optionalValue(row: Row, key: string) {
  return sanitizeNullableString(row[normalizeHeader(key)]);
}

function numberValue(row: Row, key: string) {
  const raw = value(row, key);
  if (!raw) return null;
  const normalized = raw.replace(/,/g, "");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? String(parsed) : null;
}

function yesNo(raw?: string | null) {
  const normalized = String(raw ?? "").trim().toUpperCase();
  if (!normalized) return "NO";
  return normalized === "YES" || normalized === "Y" || normalized === "TRUE" ? "YES" : "NO";
}

function excelDate(valueText: string) {
  if (!valueText) return null;
  const asNumber = Number(valueText);
  if (Number.isFinite(asNumber)) {
    const epoch = Date.UTC(1899, 11, 30);
    return new Date(epoch + asNumber * 24 * 60 * 60 * 1000);
  }
  const parsed = new Date(valueText);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function initialsFor(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("") || "U";
}

function roleFor(rawRole: string) {
  const normalized = rawRole.trim().toLowerCase();
  if (normalized === "manager") return USER_ROLES.ADMIN;
  if (normalized === "supervisor") return USER_ROLES.PLANNER;
  if (normalized === "operator") return USER_ROLES.EXECUTION;
  return USER_ROLES.EXECUTION;
}

function usernameFor(email: string, employeeId: string) {
  return sanitizeString((email.split("@")[0] || employeeId || `user-${Date.now()}`).toLowerCase());
}

async function getEquipmentMap(companyId: string) {
  const rows = await db
    .select({ id: equipmentAssets.id, equipmentCode: equipmentAssets.equipmentCode, name: equipmentAssets.name })
    .from(equipmentAssets)
    .where(eq(equipmentAssets.companyId, companyId));

  return new Map(rows.map((row) => [row.equipmentCode.trim().toLowerCase(), row]));
}

async function importLocations(companyId: string, rows: Row[], result: SheetImportSummary) {
  for (const row of rows) {
    const section = value(row, "SECTION");
    const subLocation = value(row, "LOCATION");

    if (!section || !subLocation) {
      result.skipped += 1;
      result.errors.push("Location row skipped: SECTION and LOCATION are required.");
      continue;
    }

    const [existing] = await db
      .select({ id: locations.id })
      .from(locations)
      .where(and(eq(locations.companyId, companyId), eq(locations.section, section), eq(locations.subLocation, subLocation)))
      .limit(1);

    const payload = {
      companyId,
      plant: "Main Plant",
      unit: null,
      sectionCode: optionalValue(row, "SECTION ID"),
      section,
      subLocationCode: optionalValue(row, "SUB LOCATION ID"),
      subLocation,
      areaSupervisor: optionalValue(row, "AREA SUPERVISOR"),
      shiftDetails: optionalValue(row, "SHIFT DETAILS"),
      department: optionalValue(row, "DEPARTMENT"),
      status: "ACTIVE",
      updatedAt: new Date(),
    };

    if (existing) {
      await db.update(locations).set(payload).where(eq(locations.id, existing.id));
      markUpdated(result);
    } else {
      await db.insert(locations).values(payload);
      markCreated(result);
    }
  }
}

async function importEquipment(companyId: string, rows: Row[], result: SheetImportSummary) {
  const duplicateCodes = duplicateBusinessIds(rows, "EQUIPMENT ID", result);

  for (const row of rows) {
    const equipmentCode = value(row, "EQUIPMENT ID");
    const name = value(row, "EQUIPMENT NAME");
    const section = value(row, "SECTION");
    const subLocation = value(row, "SUB LOCATION");
    const category = value(row, "EQUIPMENT CATEGORY") || "Equipment";

    if (!equipmentCode || !name || !section || !subLocation) {
      result.skipped += 1;
      result.errors.push(`Equipment row skipped: EQUIPMENT ID, EQUIPMENT NAME, SECTION, and SUB LOCATION are required. Row ID: ${equipmentCode || "blank"}`);
      continue;
    }

    if (duplicateCodes.has(normalizedBusinessKey(equipmentCode))) {
      result.skipped += 1;
      continue;
    }

    await db
      .insert(equipmentCategories)
      .values({ companyId, name: category, status: "ACTIVE", updatedAt: new Date() })
      .onConflictDoUpdate({
        target: [equipmentCategories.companyId, equipmentCategories.name],
        set: { status: "ACTIVE", updatedAt: new Date() },
      });

    const [location] = await db
      .select({ id: locations.id })
      .from(locations)
      .where(and(eq(locations.companyId, companyId), eq(locations.section, section), eq(locations.subLocation, subLocation)))
      .limit(1);

    const [existing] = await db
      .select({ id: equipmentAssets.id })
      .from(equipmentAssets)
      .where(and(eq(equipmentAssets.companyId, companyId), eq(equipmentAssets.equipmentCode, equipmentCode)))
      .limit(1);

    await db
      .insert(equipmentAssets)
      .values({
        companyId,
        locationId: location?.id ?? null,
        equipmentCode,
        name,
        category,
        section,
        subLocation,
        makeBrand: optionalValue(row, "MAKE BRAND"),
        modelNumber: optionalValue(row, "MODEL NUMBER"),
        commissionedAt: excelDate(value(row, "COMMISSIONED DATE")),
        criticality: value(row, "CRITICALITY") || "MEDIUM",
        notes: optionalValue(row, "NOTES"),
        status: "ACTIVE",
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [equipmentAssets.companyId, equipmentAssets.equipmentCode],
        set: {
          locationId: location?.id ?? null,
          name,
          category,
          section,
          subLocation,
          makeBrand: optionalValue(row, "MAKE BRAND"),
          modelNumber: optionalValue(row, "MODEL NUMBER"),
          commissionedAt: excelDate(value(row, "COMMISSIONED DATE")),
          criticality: value(row, "CRITICALITY") || "MEDIUM",
          notes: optionalValue(row, "NOTES"),
          status: "ACTIVE",
          updatedAt: new Date(),
        },
      });

    if (existing) {
      markUpdated(result);
    } else {
      markCreated(result);
    }
  }
}

async function importIssueCategories(companyId: string, rows: Row[], result: SheetImportSummary) {
  for (const row of rows) {
    const name = value(row, "ISSUE CATEGORY");
    const equipmentFunction = optionalValue(row, "EQUIPMENT FUNCTIONS");
    const failureMode = optionalValue(row, "FAILURE MODE");

    if (!name) {
      result.skipped += 1;
      result.errors.push("Issue category row skipped: ISSUE CATEGORY is required.");
      continue;
    }

    const [existing] = await db
      .select({ id: issueCategories.id })
      .from(issueCategories)
      .where(
        and(
          eq(issueCategories.companyId, companyId),
          eq(issueCategories.name, name),
          sql`coalesce(${issueCategories.equipmentFunction}, '') = ${equipmentFunction ?? ""}`,
          sql`coalesce(${issueCategories.failureMode}, '') = ${failureMode ?? ""}`,
        ),
      )
      .limit(1);

    const payload = {
      companyId,
      categoryCode: optionalValue(row, "ISSUE CATEGORY ID"),
      name,
      moduleType: "EQUIPMENT_LOG",
      equipmentFunction,
      issueStatus: optionalValue(row, "ISSUE STATUS"),
      severityDefault: value(row, "SEVERITY LEVEL") || "MEDIUM",
      failureMode,
      sparePartRef: optionalValue(row, "SPARE PART/ CONSUMABLES REF"),
      maintenanceType: optionalValue(row, "MAINTENANCE TYPE"),
      productionImpact: optionalValue(row, "PRODUCTION IMPACT"),
      notes: optionalValue(row, "NOTES"),
      status: "ACTIVE",
      updatedAt: new Date(),
    };

    if (existing) {
      await db.update(issueCategories).set(payload).where(eq(issueCategories.id, existing.id));
      markUpdated(result);
    } else {
      await db.insert(issueCategories).values(payload);
      markCreated(result);
    }
  }
}

async function importSafety(companyId: string, rows: Row[], result: SheetImportSummary) {
  for (const row of rows) {
    const incidentCategory = value(row, "INCIDENT CATEGORY");
    const incidentType = value(row, "INCIDENT TYPE");

    if (!incidentCategory || !incidentType) {
      result.skipped += 1;
      result.errors.push("Safety row skipped: INCIDENT CATEGORY and INCIDENT TYPE are required.");
      continue;
    }

    const severityLevel = value(row, "SEVERITY LEVEL") || "MEDIUM";
    const [existing] = await db
      .select({ id: safetyReportingMasters.id })
      .from(safetyReportingMasters)
      .where(
        and(
          eq(safetyReportingMasters.companyId, companyId),
          eq(safetyReportingMasters.incidentCategory, incidentCategory),
          eq(safetyReportingMasters.incidentType, incidentType),
          eq(safetyReportingMasters.severityLevel, severityLevel),
        ),
      )
      .limit(1);

    const payload = {
      companyId,
      safetyCategoryCode: optionalValue(row, "SAFETY CATEGORY ID"),
      incidentCategory,
      incidentType,
      severityLevel,
      requiresPpe: yesNo(value(row, "REQUIRES PPE")),
      ppeType: optionalValue(row, "PPE TYPE"),
      reportable: yesNo(value(row, "REPORTABLE (FACTORIES ACT)")),
      immediateActionRequired: yesNo(value(row, "IMMEDIATE ACTION REQUIRED")),
      notes: optionalValue(row, "NOTES"),
      status: "ACTIVE",
      updatedAt: new Date(),
    };

    if (existing) {
      await db.update(safetyReportingMasters).set(payload).where(eq(safetyReportingMasters.id, existing.id));
      markUpdated(result);
    } else {
      await db.insert(safetyReportingMasters).values(payload);
      markCreated(result);
    }
  }
}

async function importMeasuringPoints(companyId: string, rows: Row[], result: SheetImportSummary) {
  const equipmentMap = await getEquipmentMap(companyId);
  const duplicateCodes = duplicateBusinessIds(rows, "POINT ID", result);

  for (const row of rows) {
    const pointCode = value(row, "POINT ID");
    const measurementName = value(row, "MEASUREMENT NAME");
    const equipmentCode = value(row, "EQUIPMENT ID");
    const equipment = equipmentMap.get(equipmentCode.toLowerCase());

    if (!pointCode || !measurementName) {
      result.skipped += 1;
      result.errors.push(`Measuring point row skipped: POINT ID and MEASUREMENT NAME are required. Point: ${pointCode || "blank"}`);
      continue;
    }

    if (duplicateCodes.has(normalizedBusinessKey(pointCode))) {
      result.skipped += 1;
      continue;
    }

    if (equipmentCode && !equipment) {
      result.errors.push(`Measuring point ${pointCode}: equipment ${equipmentCode} was not found; imported without equipment link.`);
    }

    const [existing] = await db
      .select({ id: measuringPoints.id })
      .from(measuringPoints)
      .where(and(eq(measuringPoints.companyId, companyId), eq(measuringPoints.pointCode, pointCode)))
      .limit(1);

    await db
      .insert(measuringPoints)
      .values({
        companyId,
        equipmentId: equipment?.id ?? null,
        pointCode,
        equipmentCodeSnapshot: equipmentCode || null,
        equipmentNameSnapshot: value(row, "EQUIPMENT NAME") || equipment?.name || null,
        measurementName,
        measurementUnit: value(row, "MEASUREMENT UNIT") || "-",
        targetValue: numberValue(row, "TARGET VALUE"),
        lowerLimit: numberValue(row, "LOWER LIMIT"),
        upperLimit: numberValue(row, "UPPER LIMIT"),
        measurementFrequency: optionalValue(row, "MEASUREMENT FREQUENCY"),
        alertSeverity: value(row, "ALERT SEVERITY") || "MEDIUM",
        instrumentTag: optionalValue(row, "INSTRUMENT TAG"),
        notes: optionalValue(row, "NOTES"),
        status: "ACTIVE",
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [measuringPoints.companyId, measuringPoints.pointCode],
        set: {
          equipmentId: equipment?.id ?? null,
          equipmentCodeSnapshot: equipmentCode || null,
          equipmentNameSnapshot: value(row, "EQUIPMENT NAME") || equipment?.name || null,
          measurementName,
          measurementUnit: value(row, "MEASUREMENT UNIT") || "-",
          targetValue: numberValue(row, "TARGET VALUE"),
          lowerLimit: numberValue(row, "LOWER LIMIT"),
          upperLimit: numberValue(row, "UPPER LIMIT"),
          measurementFrequency: optionalValue(row, "MEASUREMENT FREQUENCY"),
          alertSeverity: value(row, "ALERT SEVERITY") || "MEDIUM",
          instrumentTag: optionalValue(row, "INSTRUMENT TAG"),
          notes: optionalValue(row, "NOTES"),
          status: "ACTIVE",
          updatedAt: new Date(),
        },
      });

    if (existing) {
      markUpdated(result);
    } else {
      markCreated(result);
    }
  }
}

async function importMeterCounters(companyId: string, rows: Row[], result: SheetImportSummary) {
  const equipmentMap = await getEquipmentMap(companyId);
  const duplicateCodes = duplicateBusinessIds(rows, "COUNTER ID", result);

  for (const row of rows) {
    const counterCode = value(row, "COUNTER ID");
    const counterName = value(row, "COUNTER NAME");
    const equipmentCode = value(row, "EQUIPMENT ID");
    const equipment = equipmentMap.get(equipmentCode.toLowerCase());

    if (!counterCode || !counterName) {
      result.skipped += 1;
      result.errors.push(`Meter counter row skipped: COUNTER ID and COUNTER NAME are required. Counter: ${counterCode || "blank"}`);
      continue;
    }

    if (duplicateCodes.has(normalizedBusinessKey(counterCode))) {
      result.skipped += 1;
      continue;
    }

    if (equipmentCode && !equipment) {
      result.errors.push(`Meter counter ${counterCode}: equipment ${equipmentCode} was not found; imported without equipment link.`);
    }

    const [existing] = await db
      .select({ id: meterCounters.id })
      .from(meterCounters)
      .where(and(eq(meterCounters.companyId, companyId), eq(meterCounters.counterCode, counterCode)))
      .limit(1);

    await db
      .insert(meterCounters)
      .values({
        companyId,
        equipmentId: equipment?.id ?? null,
        counterCode,
        equipmentCodeSnapshot: equipmentCode || null,
        location: optionalValue(row, "LOCATION"),
        counterName,
        counterUnit: value(row, "COUNTER UoM") || "-",
        meterType: value(row, "METER TYPE") || "Other",
        readingFrequency: optionalValue(row, "READING FREQUENCY"),
        initialReading: numberValue(row, "INITIAL READING"),
        resetValue: numberValue(row, "RESET VALUE"),
        expectedDailyConsumption: numberValue(row, "EXPECTED DAILY CONSUMPTION"),
        alertDeviationPct: numberValue(row, "ALERT DEVIATION PCT"),
        notes: optionalValue(row, "NOTES"),
        status: "ACTIVE",
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [meterCounters.companyId, meterCounters.counterCode],
        set: {
          equipmentId: equipment?.id ?? null,
          equipmentCodeSnapshot: equipmentCode || null,
          location: optionalValue(row, "LOCATION"),
          counterName,
          counterUnit: value(row, "COUNTER UoM") || "-",
          meterType: value(row, "METER TYPE") || "Other",
          readingFrequency: optionalValue(row, "READING FREQUENCY"),
          initialReading: numberValue(row, "INITIAL READING"),
          resetValue: numberValue(row, "RESET VALUE"),
          expectedDailyConsumption: numberValue(row, "EXPECTED DAILY CONSUMPTION"),
          alertDeviationPct: numberValue(row, "ALERT DEVIATION PCT"),
          notes: optionalValue(row, "NOTES"),
          status: "ACTIVE",
          updatedAt: new Date(),
        },
      });

    if (existing) {
      markUpdated(result);
    } else {
      markCreated(result);
    }
  }
}

async function importKaizen(companyId: string, rows: Row[], result: SheetImportSummary) {
  for (const row of rows) {
    const category = value(row, "KAIZEN CATEGORY");
    if (!category) {
      result.skipped += 1;
      result.errors.push("Kaizen row skipped: KAIZEN CATEGORY is required.");
      continue;
    }

    const department = optionalValue(row, "DEPARTMENT");
    const [existing] = await db
      .select({ id: kaizenCategories.id })
      .from(kaizenCategories)
      .where(
        and(
          eq(kaizenCategories.companyId, companyId),
          eq(kaizenCategories.category, category),
          sql`coalesce(${kaizenCategories.department}, '') = ${department ?? ""}`,
        ),
      )
      .limit(1);

    const payload = {
      companyId,
      kaizenCategoryCode: optionalValue(row, "KAIZEN CATEGORY ID") || category.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
      category,
      department,
      kaizenStatus: optionalValue(row, "STATUS"),
      immediateActionRequired: yesNo(value(row, "IMMEDIATE ACTION REQUIRED")),
      notes: optionalValue(row, "NOTES"),
      status: "ACTIVE",
      updatedAt: new Date(),
    };

    if (existing) {
      await db.update(kaizenCategories).set(payload).where(eq(kaizenCategories.id, existing.id));
      markUpdated(result);
    } else {
      await db.insert(kaizenCategories).values(payload);
      markCreated(result);
    }
  }
}

async function importUsers(companyId: string, rows: Row[], result: SheetImportSummary) {
  const passwordHash = await hashPassword(DEFAULT_TEMP_PASSWORD);
  const duplicateEmployeeIds = duplicateBusinessIds(rows, "EMPLOYEE ID", result);

  for (const row of rows) {
    const fullName = value(row, "FULL NAME");
    const email = value(row, "EMAIL").toLowerCase();
    const employeeId = value(row, "EMPLOYEE ID");

    if (!employeeId || !fullName || !email) {
      result.skipped += 1;
      result.errors.push(`User row skipped: EMPLOYEE ID, FULL NAME, and EMAIL are required. Employee ID: ${employeeId || "blank"}`);
      continue;
    }

    if (duplicateEmployeeIds.has(normalizedBusinessKey(employeeId))) {
      result.skipped += 1;
      continue;
    }

    const [existingByEmployeeId] = await db
      .select({ id: admins.id })
      .from(admins)
      .where(and(eq(admins.companyId, companyId), eq(admins.employeeId, employeeId)))
      .limit(1);
    const [existingByEmail] = await db
      .select({ id: admins.id, employeeId: admins.employeeId })
      .from(admins)
      .where(eq(admins.email, email))
      .limit(1);

    if (existingByEmail && existingByEmail.id !== existingByEmployeeId?.id) {
      result.skipped += 1;
      result.errors.push(`User ${employeeId} skipped: email ${email} already belongs to another user.`);
      continue;
    }

    const payload = {
      companyId,
      employeeId,
      fullName,
      initials: initialsFor(fullName),
      username: usernameFor(email, employeeId),
      email,
      phone: value(row, "PHONE") || "NA",
      role: roleFor(value(row, "ROLE")),
      status: yesNo(value(row, "ACTIVE")) === "NO" ? USER_STATUS.INACTIVE : USER_STATUS.ACTIVE,
      updatedAt: new Date(),
    };

    if (existingByEmployeeId) {
      await db.update(admins).set(payload).where(eq(admins.id, existingByEmployeeId.id));
      markUpdated(result);
    } else {
      await db.insert(admins).values({ ...payload, passwordHash, requirePasswordReset: true });
      markCreated(result);
    }
  }
}

export async function importFinalMasterDataTemplate(input: {
  companyId: string;
  fileName?: string;
  buffer: Buffer;
}): Promise<MasterDataImportResult> {
  const workbook = XLSX.read(input.buffer, { type: "buffer", cellDates: false });
  const result: MasterDataImportResult = { fileName: input.fileName, sheets: [] };

  const locationsSheet = readSheetRows(workbook, SHEETS.locations);
  const locationsSummary = summary(locationsSheet.sheetName);
  await importLocations(input.companyId, locationsSheet.rows, locationsSummary);
  result.sheets.push(locationsSummary);

  const equipmentSheet = readSheetRows(workbook, SHEETS.equipment);
  const equipmentSummary = summary(equipmentSheet.sheetName);
  await importEquipment(input.companyId, equipmentSheet.rows, equipmentSummary);
  result.sheets.push(equipmentSummary);

  const issueSheet = readSheetRows(workbook, SHEETS.issueCategories);
  const issueSummary = summary(issueSheet.sheetName);
  await importIssueCategories(input.companyId, issueSheet.rows, issueSummary);
  result.sheets.push(issueSummary);

  const safetySheet = readSheetRows(workbook, SHEETS.safety);
  const safetySummary = summary(safetySheet.sheetName);
  await importSafety(input.companyId, safetySheet.rows, safetySummary);
  result.sheets.push(safetySummary);

  const measuringSheet = readSheetRows(workbook, SHEETS.measuringPoints);
  const measuringSummary = summary(measuringSheet.sheetName);
  await importMeasuringPoints(input.companyId, measuringSheet.rows, measuringSummary);
  result.sheets.push(measuringSummary);

  const countersSheet = readSheetRows(workbook, SHEETS.meterCounters);
  const countersSummary = summary(countersSheet.sheetName);
  await importMeterCounters(input.companyId, countersSheet.rows, countersSummary);
  result.sheets.push(countersSummary);

  const usersSheet = readSheetRows(workbook, SHEETS.users);
  const usersSummary = summary(usersSheet.sheetName);
  await importUsers(input.companyId, usersSheet.rows, usersSummary);
  result.sheets.push(usersSummary);

  const kaizenSheet = readSheetRows(workbook, SHEETS.kaizen);
  const kaizenSummary = summary(kaizenSheet.sheetName);
  await importKaizen(input.companyId, kaizenSheet.rows, kaizenSummary);
  result.sheets.push(kaizenSummary);

  return result;
}


type SampleSheet = {
  name: string;
  description: string;
  headers: string[];
  rows: string[][];
};

const SAMPLE_SHEETS: SampleSheet[] = [
  {
    name: SHEETS.equipment,
    description: "Company equipment assets used by logs, measurements, counters, manuals, and reports.",
    headers: ["EQUIPMENT ID", "EQUIPMENT NAME", "SECTION", "SUB LOCATION", "EQUIPMENT CATEGORY", "MAKE BRAND", "MODEL NUMBER", "COMMISSIONED DATE", "CRITICALITY", "NOTES"],
    rows: [
      ["EQ-001", "Air Compressor 1", "Utilities", "Compressor Room", "Utilities", "Atlas Copco", "GA 18", "2024-01-15", "High", "Primary plant air compressor"],
      ["EQ-002", "Hydraulic Press", "Press Shop", "Press Bay 1", "Production", "Bosch Rexroth", "HP-250", "2023-11-20", "Critical", "Main press line"],
    ],
  },
  {
    name: SHEETS.issueCategories,
    description: "Issue mapping used by equipment/shift AI extraction, severity defaults, reports, and dropdowns.",
    headers: ["ISSUE CATEGORY ID", "ISSUE CATEGORY", "EQUIPMENT FUNCTIONS", "FAILURE MODE", "ISSUE STATUS", "SEVERITY LEVEL", "SPARE PART/ CONSUMABLES REF", "MAINTENANCE TYPE", "PRODUCTION IMPACT", "NOTES"],
    rows: [
      ["IC-001", "Hydraulic Leak", "Hydraulic System", "Seal leak", "Open", "High", "Seal kit", "Corrective", "Line stoppage", "Use for oil or hydraulic leakage"],
      ["IC-002", "Abnormal Noise", "Rotating Equipment", "Bearing wear", "Pending investigation", "Medium", "Bearing", "Inspection", "Reduced speed", "Use for vibration or grinding noise"],
    ],
  },
  {
    name: SHEETS.safety,
    description: "Safety reporting master used by safety module dropdowns, AI mapping, reportable flags, and PPE defaults.",
    headers: ["SAFETY CATEGORY ID", "INCIDENT CATEGORY", "INCIDENT TYPE", "SEVERITY LEVEL", "REQUIRES PPE", "PPE TYPE", "REPORTABLE (FACTORIES ACT)", "IMMEDIATE ACTION REQUIRED", "NOTES"],
    rows: [
      ["SC-001", "Unsafe Condition", "Oil spill near walkway", "High", "YES", "Safety shoes, gloves", "NO", "YES", "Barricade and clean immediately"],
      ["SC-002", "Near Miss", "Material dropped from height", "Critical", "YES", "Helmet", "YES", "YES", "Escalate to safety officer"],
    ],
  },
  {
    name: SHEETS.measuringPoints,
    description: "Manual measurement points. Voice is disabled; feed alert only when reading is outside lower/upper limits.",
    headers: ["POINT ID", "MEASUREMENT NAME", "EQUIPMENT ID", "EQUIPMENT NAME", "MEASUREMENT UNIT", "TARGET VALUE", "LOWER LIMIT", "UPPER LIMIT", "MEASUREMENT FREQUENCY", "ALERT SEVERITY", "INSTRUMENT TAG", "NOTES"],
    rows: [
      ["MP-001", "Bearing Temperature", "EQ-001", "Air Compressor 1", "C", "70", "40", "85", "Every Shift", "High", "TT-101", "Alert if temperature crosses limit"],
      ["MP-002", "Discharge Pressure", "EQ-001", "Air Compressor 1", "bar", "7", "5", "9", "Daily", "Medium", "PT-204", "Manual reading"],
    ],
  },
  {
    name: SHEETS.meterCounters,
    description: "Manual counter readings. Voice is disabled; feed alert only when consumption/deviation crosses threshold.",
    headers: ["COUNTER ID", "COUNTER NAME", "EQUIPMENT ID", "LOCATION", "COUNTER UoM", "METER TYPE", "READING FREQUENCY", "INITIAL READING", "RESET VALUE", "EXPECTED DAILY CONSUMPTION", "ALERT DEVIATION PCT", "NOTES"],
    rows: [
      ["MC-001", "Compressor Runtime", "EQ-001", "Compressor Room", "hours", "Runtime", "Daily", "15000", "0", "20", "25", "Alert if runtime deviates"],
      ["MC-002", "Power Consumption", "EQ-001", "Compressor Room", "kWh", "Energy", "Daily", "250000", "0", "300", "20", "Daily energy meter"],
    ],
  },
  {
    name: SHEETS.users,
    description: "Company users. Roles map as Manager=Admin, Supervisor=Planner, Operator=Execution.",
    headers: ["EMPLOYEE ID", "FULL NAME", "EMAIL", "PHONE", "ROLE", "ACTIVE"],
    rows: [
      ["EMP-001", "Alex Rivera", "alex.rivera@example.com", "+919024218889", "Manager", "YES"],
      ["EMP-002", "Neha Shah", "neha.shah@example.com", "+919024218890", "Supervisor", "YES"],
      ["EMP-003", "Ravi Patel", "ravi.patel@example.com", "+919024218891", "Operator", "YES"],
    ],
  },
  {
    name: SHEETS.kaizen,
    description: "Kaizen/suggestion categories used by kaizen module dropdowns and report mapping.",
    headers: ["KAIZEN CATEGORY ID", "KAIZEN CATEGORY", "DEPARTMENT", "STATUS", "IMMEDIATE ACTION REQUIRED", "NOTES"],
    rows: [
      ["KZ-001", "Process Improvement", "Maintenance", "Open", "NO", "General improvement idea"],
      ["KZ-002", "Safety Improvement", "Safety", "Open", "YES", "Use when immediate correction is required"],
    ],
  },
  {
    name: SHEETS.locations,
    description: "Plant hierarchy, shift details, departments, and location dropdowns.",
    headers: ["SECTION ID", "SECTION", "SUB LOCATION ID", "LOCATION", "AREA SUPERVISOR", "SHIFT DETAILS", "DEPARTMENT"],
    rows: [
      ["SEC-001", "Utilities", "LOC-001", "Compressor Room", "Neha Shah", "A Shift", "Maintenance"],
      ["SEC-002", "Press Shop", "LOC-002", "Press Bay 1", "Amit Desai", "B Shift", "Production"],
    ],
  },
];

function addSampleSheet(workbook: XLSX.WorkBook, sheet: SampleSheet) {
  const rows = [
    ["VoxLogiX Master Data Import", sheet.description],
    [],
    sheet.headers,
    [],
    ...sheet.rows,
  ];
  const worksheet = XLSX.utils.aoa_to_sheet(rows);
  worksheet["!cols"] = sheet.headers.map((header) => ({ wch: Math.max(16, Math.min(34, header.length + 4)) }));
  XLSX.utils.book_append_sheet(workbook, worksheet, sheet.name.slice(0, 31));
}

export function buildFinalMasterDataSampleWorkbook() {
  const workbook = XLSX.utils.book_new();
  for (const sheet of SAMPLE_SHEETS) {
    addSampleSheet(workbook, sheet);
  }
  return XLSX.write(workbook, { bookType: "xlsx", type: "buffer" }) as Buffer;
}
