import { and, eq, inArray, sql } from "drizzle-orm";
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
import { getEnabledModuleNamesForCompany } from "@/modules/modules/module.service";
import type {
  CommitMasterDataImportInput,
  MasterDataImportPreview,
  MasterDataImportResult,
  MasterDataSheetKey,
  PreviewRow,
  PreviewRowError,
  PreviewSheet,
  SheetImportSummary,
} from "@/modules/master-data-imports/master-data-import.types";
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

// Module gating matrix — derived from actual usage (which modules' field configs actually
// reference each master-data-options sourceKey in the live database), not assumption:
//
//  - Equipment Master: CORE. Every module that references equipment (Safety, Measurement
//    Point, Meter Counter, Kaizen logs) does so by equipment code lookup at import time,
//    regardless of whether the "Equipment Log" module itself is enabled — gating it behind
//    Equipment Log would silently break equipment linking for every OTHER enabled module.
//  - Users & Roles: CORE. Every company needs to manage its own staff regardless of which
//    operational modules are enabled.
//  - Sections/Locations/Shift: CORE/SHARED. Real usage shows both "Shift Log" and "Kaizen"
//    module field configs reference this lookup, and Equipment import also looks up
//    Location by section+sub-location — gating it to either module alone would incorrectly
//    reject data a different enabled module (or Equipment) still needs.
//  - Issue Categories: gated to "Equipment Log" — the only module whose field configs
//    reference it, and its own moduleType column is literally "EQUIPMENT_LOG".
//  - Safety Reporting: gated to "Safety Log" — the only consumer.
//  - Measuring Points: gated to "Measurement Point" — the only consumer.
//  - Meter Counters: gated to "Meter Counter" — the only consumer.
//  - Kaizen: gated to "Kaizen" — the only consumer.
const SHEET_GATING: Record<keyof typeof SHEETS, string | null> = {
  locations: null,
  equipment: null,
  issueCategories: "Equipment Log",
  safety: "Safety Log",
  measuringPoints: "Measurement Point",
  meterCounters: "Meter Counter",
  users: null,
  kaizen: "Kaizen",
};

const SHEET_FORWARD_FILL_COLUMNS: Record<keyof typeof SHEETS, string[]> = {
  locations: ["SECTION", "LOCATION"],
  equipment: [],
  issueCategories: ["ISSUE CATEGORY"],
  safety: ["INCIDENT CATEGORY"],
  measuringPoints: [],
  meterCounters: [],
  users: [],
  kaizen: ["KAIZEN CATEGORY"],
};

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

// Excel merges a cell across several rows when someone visually groups rows under one
// shared label instead of retyping it on every row (a very natural way to lay out a
// "Category" column) — every row but the first in that merge reads back as a genuinely
// empty cell, since the value only lives in the merge's top-left cell. This carries a
// forward-filled column's last non-blank value down into the following blank cells,
// recovering exactly that case, without ever inventing a relationship between different
// columns — it only ever fills gaps in one column from that same column's own prior row.
// Only ever applied to the single "category/name" lookup column per sheet, never to an
// entity's own unique ID column (Equipment ID, Point ID, Counter ID, Employee ID) — those
// must never be silently inherited from a previous row.
function forwardFill(rows: Row[], columns: string[]) {
  const lastValue = new Map<string, string>();

  for (const row of rows) {
    for (const column of columns) {
      if (row[column]) {
        lastValue.set(column, row[column]);
      } else if (lastValue.has(column)) {
        row[column] = lastValue.get(column)!;
      }
    }
  }
}

function readSheetRows(workbook: XLSX.WorkBook, namePart: string, forwardFillColumns: string[] = []): { sheetName: string; rows: Row[] } {
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

  // Drop genuinely blank spacer rows BEFORE forward-filling, so one doesn't get resurrected
  // into a sparse, unintended entry just because it inherits a carried-forward category.
  const nonBlankRows = rows.filter((row) => Object.values(row).some(Boolean));
  const normalizedForwardFillColumns = forwardFillColumns.map(normalizeHeader);
  if (normalizedForwardFillColumns.length) {
    forwardFill(nonBlankRows, normalizedForwardFillColumns);
  }

  return {
    sheetName: found.sheetName,
    rows: nonBlankRows,
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

    // Issue Category is lookup/option data — no unique business ID, no row relationship.
    // Uniqueness is company + normalized name only, matching normalizedBusinessKey's
    // existing trim+lowercase convention used elsewhere in this file. Re-uploading the same
    // name (even with different EQUIPMENT FUNCTIONS/FAILURE MODE alongside it) must update
    // the same row, not create a second one for the same category.
    const [existing] = await db
      .select({ id: issueCategories.id })
      .from(issueCategories)
      .where(
        and(
          eq(issueCategories.companyId, companyId),
          sql`lower(${issueCategories.name}) = ${normalizedBusinessKey(name)}`,
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
    // Kaizen Category is lookup/option data — dedupe by company + normalized category name
    // only (same convention as Issue Categories above), not name+department.
    const [existing] = await db
      .select({ id: kaizenCategories.id })
      .from(kaizenCategories)
      .where(
        and(
          eq(kaizenCategories.companyId, companyId),
          sql`lower(${kaizenCategories.category}) = ${normalizedBusinessKey(category)}`,
        ),
      )
      .limit(1);

    const payload = {
      companyId,
      // No synthetic fallback ID — Kaizen Category is lookup data with no business unique ID
      // requirement; leave this null when the sheet doesn't supply one.
      kaizenCategoryCode: optionalValue(row, "KAIZEN CATEGORY ID"),
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

// ============================================================================
// Preview (read-only) — validates and classifies rows without writing anything.
// Mirrors each importX writer's own required-field/duplicate rules exactly, so preview
// and commit never disagree about what's valid.
// ============================================================================

function requiredError(field: string, label: string): PreviewRowError {
  return { field, code: "REQUIRED", message: `${label} is required.` };
}

function duplicateRowIndexes(rows: Row[], header: string): Set<number> {
  const indexesByKey = new Map<string, number[]>();

  rows.forEach((row, index) => {
    const raw = value(row, header);
    if (!raw) return;
    const key = normalizedBusinessKey(raw);
    indexesByKey.set(key, [...(indexesByKey.get(key) ?? []), index]);
  });

  const duplicateIndexes = new Set<number>();
  for (const indexes of indexesByKey.values()) {
    if (indexes.length > 1) indexes.forEach((index) => duplicateIndexes.add(index));
  }
  return duplicateIndexes;
}

function makePreviewRow(index: number, row: Row, errors: PreviewRowError[]): PreviewRow {
  // +5: row 1 is the title, row 3 the header, row 5 the first data row (1-indexed), matching
  // the same offset readSheetRows/duplicateBusinessIds already use for user-facing row numbers.
  return {
    previewId: `row-${index}`,
    status: errors.length ? "rejected" : "accepted",
    originalRowNumber: index + 5,
    values: row,
    errors,
  };
}

function previewLocationsRows(rows: Row[]): PreviewRow[] {
  return rows.map((row, index) => {
    const errors: PreviewRowError[] = [];
    if (!value(row, "SECTION")) errors.push(requiredError("SECTION", "Section"));
    if (!value(row, "LOCATION")) errors.push(requiredError("LOCATION", "Location"));
    return makePreviewRow(index, row, errors);
  });
}

function previewEquipmentRows(rows: Row[]): PreviewRow[] {
  const duplicates = duplicateRowIndexes(rows, "EQUIPMENT ID");

  return rows.map((row, index) => {
    const errors: PreviewRowError[] = [];
    if (!value(row, "EQUIPMENT ID")) errors.push(requiredError("EQUIPMENT ID", "Equipment ID"));
    else if (duplicates.has(index)) {
      errors.push({ field: "EQUIPMENT ID", code: "DUPLICATE", message: "Equipment ID appears more than once in this workbook." });
    }
    if (!value(row, "EQUIPMENT NAME")) errors.push(requiredError("EQUIPMENT NAME", "Equipment Name"));
    if (!value(row, "SECTION")) errors.push(requiredError("SECTION", "Section"));
    if (!value(row, "SUB LOCATION")) errors.push(requiredError("SUB LOCATION", "Sub Location"));
    return makePreviewRow(index, row, errors);
  });
}

function previewIssueCategoriesRows(rows: Row[]): PreviewRow[] {
  return rows.map((row, index) => {
    const errors: PreviewRowError[] = [];
    if (!value(row, "ISSUE CATEGORY")) errors.push(requiredError("ISSUE CATEGORY", "Issue Category"));
    return makePreviewRow(index, row, errors);
  });
}

function previewSafetyRows(rows: Row[]): PreviewRow[] {
  return rows.map((row, index) => {
    const errors: PreviewRowError[] = [];
    if (!value(row, "INCIDENT CATEGORY")) errors.push(requiredError("INCIDENT CATEGORY", "Incident Category"));
    if (!value(row, "INCIDENT TYPE")) errors.push(requiredError("INCIDENT TYPE", "Incident Type"));
    return makePreviewRow(index, row, errors);
  });
}

async function previewMeasuringPointsRows(companyId: string, rows: Row[]): Promise<PreviewRow[]> {
  const equipmentMap = await getEquipmentMap(companyId);
  const duplicates = duplicateRowIndexes(rows, "POINT ID");

  return rows.map((row, index) => {
    const errors: PreviewRowError[] = [];
    if (!value(row, "POINT ID")) errors.push(requiredError("POINT ID", "Point ID"));
    else if (duplicates.has(index)) {
      errors.push({ field: "POINT ID", code: "DUPLICATE", message: "Point ID appears more than once in this workbook." });
    }
    if (!value(row, "MEASUREMENT NAME")) errors.push(requiredError("MEASUREMENT NAME", "Measurement Name"));

    // Non-blocking: the importer still creates the point without a link when the referenced
    // equipment isn't found (same as today) — surfaced here for visibility, not rejection.
    const equipmentCode = value(row, "EQUIPMENT ID");
    if (equipmentCode && !equipmentMap.get(equipmentCode.toLowerCase())) {
      errors.push({ field: "EQUIPMENT ID", code: "UNKNOWN_REFERENCE", message: `Equipment ${equipmentCode} was not found — will import without an equipment link.` });
    }

    const row_ = makePreviewRow(index, row, errors);
    // Override: only the two required-field checks above are blocking; an unknown equipment
    // reference alone must not mark the row rejected, matching the importer's own behavior.
    row_.status = !value(row, "POINT ID") || !value(row, "MEASUREMENT NAME") || duplicates.has(index) ? "rejected" : "accepted";
    return row_;
  });
}

async function previewMeterCountersRows(companyId: string, rows: Row[]): Promise<PreviewRow[]> {
  const equipmentMap = await getEquipmentMap(companyId);
  const duplicates = duplicateRowIndexes(rows, "COUNTER ID");

  return rows.map((row, index) => {
    const errors: PreviewRowError[] = [];
    if (!value(row, "COUNTER ID")) errors.push(requiredError("COUNTER ID", "Counter ID"));
    else if (duplicates.has(index)) {
      errors.push({ field: "COUNTER ID", code: "DUPLICATE", message: "Counter ID appears more than once in this workbook." });
    }
    if (!value(row, "COUNTER NAME")) errors.push(requiredError("COUNTER NAME", "Counter Name"));

    const equipmentCode = value(row, "EQUIPMENT ID");
    if (equipmentCode && !equipmentMap.get(equipmentCode.toLowerCase())) {
      errors.push({ field: "EQUIPMENT ID", code: "UNKNOWN_REFERENCE", message: `Equipment ${equipmentCode} was not found — will import without an equipment link.` });
    }

    const row_ = makePreviewRow(index, row, errors);
    row_.status = !value(row, "COUNTER ID") || !value(row, "COUNTER NAME") || duplicates.has(index) ? "rejected" : "accepted";
    return row_;
  });
}

async function previewUsersRows(companyId: string, rows: Row[]): Promise<PreviewRow[]> {
  const duplicates = duplicateRowIndexes(rows, "EMPLOYEE ID");

  // Mirrors importUsers' own two lookups exactly, just batched across the whole sheet
  // instead of once per row: existingByEmployeeId is scoped to this company (an update);
  // existingByEmail is global (email is unique platform-wide) — if a row's email already
  // belongs to a different admin record than the one its Employee ID would update, that's
  // the same conflict importUsers rejects at commit time.
  const employeeIds = rows.map((row) => value(row, "EMPLOYEE ID")).filter(Boolean);
  const emails = rows.map((row) => value(row, "EMAIL").toLowerCase()).filter(Boolean);

  const byEmployeeId = employeeIds.length
    ? await db.select({ id: admins.id, employeeId: admins.employeeId }).from(admins).where(and(eq(admins.companyId, companyId), inArray(admins.employeeId, employeeIds)))
    : [];
  // Emails are already stored lowercase (importUsers lowercases on write), so a plain
  // inArray against the already-lowercased lookup list matches without needing lower().
  const byEmail = emails.length
    ? await db.select({ id: admins.id, email: admins.email }).from(admins).where(inArray(admins.email, emails))
    : [];

  const adminIdByEmployeeId = new Map(byEmployeeId.map((admin) => [admin.employeeId, admin.id]));
  const adminIdByEmail = new Map(byEmail.map((admin) => [admin.email.toLowerCase(), admin.id]));

  return rows.map((row, index) => {
    const errors: PreviewRowError[] = [];
    const employeeId = value(row, "EMPLOYEE ID");
    const email = value(row, "EMAIL").toLowerCase();

    if (!employeeId) errors.push(requiredError("EMPLOYEE ID", "Employee ID"));
    else if (duplicates.has(index)) {
      errors.push({ field: "EMPLOYEE ID", code: "DUPLICATE", message: "Employee ID appears more than once in this workbook." });
    }
    if (!value(row, "FULL NAME")) errors.push(requiredError("FULL NAME", "Full Name"));
    if (!email) {
      errors.push(requiredError("EMAIL", "Email"));
    } else {
      const emailOwnerId = adminIdByEmail.get(email);
      const employeeIdOwnerId = employeeId ? adminIdByEmployeeId.get(employeeId) : undefined;
      if (emailOwnerId && emailOwnerId !== employeeIdOwnerId) {
        errors.push({ field: "EMAIL", code: "DUPLICATE", message: `Email ${email} already belongs to another user.` });
      }
    }

    return makePreviewRow(index, row, errors);
  });
}

function previewKaizenRows(rows: Row[]): PreviewRow[] {
  return rows.map((row, index) => {
    const errors: PreviewRowError[] = [];
    if (!value(row, "KAIZEN CATEGORY")) errors.push(requiredError("KAIZEN CATEGORY", "Kaizen Category"));
    return makePreviewRow(index, row, errors);
  });
}

const SHEET_LABELS: Record<MasterDataSheetKey, string> = {
  locations: "Sections & Locations",
  equipment: "Equipment",
  issueCategories: "Issue Categories",
  safety: "Safety",
  measuringPoints: "Measuring Points",
  meterCounters: "Meter Counters",
  users: "Users",
  kaizen: "Kaizen",
};

export async function buildMasterDataImportPreview(input: {
  companyId: string;
  fileName?: string;
  buffer: Buffer;
}): Promise<MasterDataImportPreview> {
  const workbook = XLSX.read(input.buffer, { type: "buffer", cellDates: false });
  const enabledModules = await getEnabledModuleNamesForCompany(input.companyId);

  const sheetKeys = Object.keys(SHEETS) as MasterDataSheetKey[];
  const sheets: PreviewSheet[] = [];

  for (const key of sheetKeys) {
    const sheetName = SHEETS[key];
    const gatingModule = SHEET_GATING[key];
    const moduleEnabled = gatingModule === null || enabledModules.has(gatingModule);
    const { rows } = readSheetRows(workbook, sheetName, SHEET_FORWARD_FILL_COLUMNS[key]);

    let previewRows: PreviewRow[];
    switch (key) {
      case "locations":
        previewRows = previewLocationsRows(rows);
        break;
      case "equipment":
        previewRows = previewEquipmentRows(rows);
        break;
      case "issueCategories":
        previewRows = previewIssueCategoriesRows(rows);
        break;
      case "safety":
        previewRows = previewSafetyRows(rows);
        break;
      case "measuringPoints":
        previewRows = await previewMeasuringPointsRows(input.companyId, rows);
        break;
      case "meterCounters":
        previewRows = await previewMeterCountersRows(input.companyId, rows);
        break;
      case "users":
        previewRows = await previewUsersRows(input.companyId, rows);
        break;
      case "kaizen":
        previewRows = previewKaizenRows(rows);
        break;
    }

    if (!moduleEnabled) {
      previewRows = previewRows.map((row) => ({
        ...row,
        status: "rejected",
        errors: [{ field: "_sheet", code: "MODULE_DISABLED", message: `${gatingModule} module is not enabled for this company.` }],
      }));
    }

    const accepted = previewRows.filter((row) => row.status === "accepted").length;
    sheets.push({
      key,
      label: SHEET_LABELS[key],
      moduleEnabled,
      gatingModule,
      rows: previewRows,
      counts: { total: previewRows.length, accepted, rejected: previewRows.length - accepted },
    });
  }

  // Disabled-module sheets are out of scope for this company, not "rejected" import rows —
  // they're dropped from the response entirely so the UI never has to filter them back out,
  // and so summary/tab counts below can only ever reflect what this company can actually
  // import (see the 2026-09 UI review: mixing them in inflated "Rejected" misleadingly).
  const importableSheets = sheets.filter((sheet) => sheet.moduleEnabled);
  const ignoredSheetCount = sheets.length - importableSheets.length;

  const summary = importableSheets.reduce(
    (current, sheet) => ({
      total: current.total + sheet.counts.total,
      accepted: current.accepted + sheet.counts.accepted,
      rejected: current.rejected + sheet.counts.rejected,
    }),
    { total: 0, accepted: 0, rejected: 0 },
  );

  return { fileName: input.fileName, summary, sheets: importableSheets, ignoredSheetCount };
}

// ============================================================================
// Commit (writes) — takes the reviewer-confirmed rows (edits already applied, removed rows
// already absent) and re-validates + writes them via the exact same importX functions used
// by the old single-shot import. Module enablement is re-checked here from scratch against
// the authenticated company — never trusted from the request body — so a tampered client
// payload claiming a disabled module's rows are fine is still rejected.
// ============================================================================

export async function commitMasterDataImport(input: CommitMasterDataImportInput): Promise<MasterDataImportResult> {
  const enabledModules = await getEnabledModuleNamesForCompany(input.companyId);
  const result: MasterDataImportResult = { sheets: [] };

  const sheetsByKey = new Map(input.sheets.map((sheet) => [sheet.key, sheet]));

  for (const key of Object.keys(SHEETS) as MasterDataSheetKey[]) {
    const sheetName = SHEETS[key];
    const gatingModule = SHEET_GATING[key];
    const moduleEnabled = gatingModule === null || enabledModules.has(gatingModule);
    const requested = sheetsByKey.get(key);
    const sheetResult = summary(sheetName);

    if (!requested || !requested.rows.length) {
      result.sheets.push(sheetResult);
      continue;
    }

    if (!moduleEnabled) {
      sheetResult.skipped = requested.rows.length;
      sheetResult.errors.push(`${gatingModule} module is not enabled for this company. No rows were imported for ${sheetName}.`);
      result.sheets.push(sheetResult);
      continue;
    }

    const rows: Row[] = requested.rows.map((row) => row.values);

    switch (key) {
      case "locations":
        await importLocations(input.companyId, rows, sheetResult);
        break;
      case "equipment":
        await importEquipment(input.companyId, rows, sheetResult);
        break;
      case "issueCategories":
        await importIssueCategories(input.companyId, rows, sheetResult);
        break;
      case "safety":
        await importSafety(input.companyId, rows, sheetResult);
        break;
      case "measuringPoints":
        await importMeasuringPoints(input.companyId, rows, sheetResult);
        break;
      case "meterCounters":
        await importMeterCounters(input.companyId, rows, sheetResult);
        break;
      case "users":
        await importUsers(input.companyId, rows, sheetResult);
        break;
      case "kaizen":
        await importKaizen(input.companyId, rows, sheetResult);
        break;
    }

    result.sheets.push(sheetResult);
  }

  return result;
}

type SampleSheet = {
  name: string;
  description: string;
  headers: string[];
  rows: string[][];
};

// Entity sheets (Equipment, Measuring Points, Meter Counters, Users): each row is a
// complete record for one business-ID-identified entity — the ID column stays and is
// genuinely required. Lookup sheets (Issue Categories, Safety Reporting, Kaizen,
// Sections/Locations/Shift): each relevant column is an independent, selectable option —
// no business ID column, and values across a row don't imply any relationship between them.
const SAMPLE_SHEETS: SampleSheet[] = [
  {
    name: SHEETS.equipment,
    description: "Company equipment assets used by logs, measurements, counters, manuals, and reports. Unique ID required for each record.",
    headers: ["EQUIPMENT ID", "EQUIPMENT NAME", "SECTION", "SUB LOCATION", "EQUIPMENT CATEGORY", "MAKE BRAND", "MODEL NUMBER", "COMMISSIONED DATE", "CRITICALITY", "NOTES"],
    rows: [
      ["EQ-001", "Air Compressor 1", "Utilities", "Compressor Room", "Utilities", "Atlas Copco", "GA 18", "2024-01-15", "High", "Primary plant air compressor"],
      ["EQ-002", "Hydraulic Press", "Press Shop", "Press Bay 1", "Production", "Bosch Rexroth", "HP-250", "2023-11-20", "Critical", "Main press line"],
    ],
  },
  {
    name: SHEETS.issueCategories,
    description: "Issue mapping used by equipment/shift AI extraction, severity defaults, reports, and dropdowns. Upload values only — unique ID is not required.",
    headers: ["ISSUE CATEGORY", "EQUIPMENT FUNCTIONS", "FAILURE MODE", "ISSUE STATUS", "SEVERITY LEVEL", "SPARE PART/ CONSUMABLES REF", "MAINTENANCE TYPE", "PRODUCTION IMPACT", "NOTES"],
    rows: [
      ["Hydraulic Leak", "Hydraulic System", "Seal leak", "Open", "High", "Seal kit", "Corrective", "Line stoppage", "Use for oil or hydraulic leakage"],
      ["Abnormal Noise", "Rotating Equipment", "Bearing wear", "Pending investigation", "Medium", "Bearing", "Inspection", "Reduced speed", "Use for vibration or grinding noise"],
    ],
  },
  {
    name: SHEETS.safety,
    description: "Safety reporting master used by safety module dropdowns, AI mapping, reportable flags, and PPE defaults. Upload values only — unique ID is not required.",
    headers: ["INCIDENT CATEGORY", "INCIDENT TYPE", "SEVERITY LEVEL", "REQUIRES PPE", "PPE TYPE", "REPORTABLE (FACTORIES ACT)", "IMMEDIATE ACTION REQUIRED", "NOTES"],
    rows: [
      ["Unsafe Condition", "Oil spill near walkway", "High", "YES", "Safety shoes, gloves", "NO", "YES", "Barricade and clean immediately"],
      ["Near Miss", "Material dropped from height", "Critical", "YES", "Helmet", "YES", "YES", "Escalate to safety officer"],
    ],
  },
  {
    name: SHEETS.measuringPoints,
    description: "Manual measurement points. Voice is disabled; feed alert only when reading is outside lower/upper limits. Unique ID required for each record.",
    headers: ["POINT ID", "MEASUREMENT NAME", "EQUIPMENT ID", "EQUIPMENT NAME", "MEASUREMENT UNIT", "TARGET VALUE", "LOWER LIMIT", "UPPER LIMIT", "MEASUREMENT FREQUENCY", "ALERT SEVERITY", "INSTRUMENT TAG", "NOTES"],
    rows: [
      ["MP-001", "Bearing Temperature", "EQ-001", "Air Compressor 1", "C", "70", "40", "85", "Every Shift", "High", "TT-101", "Alert if temperature crosses limit"],
      ["MP-002", "Discharge Pressure", "EQ-001", "Air Compressor 1", "bar", "7", "5", "9", "Daily", "Medium", "PT-204", "Manual reading"],
    ],
  },
  {
    name: SHEETS.meterCounters,
    description: "Manual counter readings. Voice is disabled; feed alert only when consumption/deviation crosses threshold. Unique ID required for each record.",
    headers: ["COUNTER ID", "COUNTER NAME", "EQUIPMENT ID", "LOCATION", "COUNTER UoM", "METER TYPE", "READING FREQUENCY", "INITIAL READING", "RESET VALUE", "EXPECTED DAILY CONSUMPTION", "ALERT DEVIATION PCT", "NOTES"],
    rows: [
      ["MC-001", "Compressor Runtime", "EQ-001", "Compressor Room", "hours", "Runtime", "Daily", "15000", "0", "20", "25", "Alert if runtime deviates"],
      ["MC-002", "Power Consumption", "EQ-001", "Compressor Room", "kWh", "Energy", "Daily", "250000", "0", "300", "20", "Daily energy meter"],
    ],
  },
  {
    name: SHEETS.users,
    description: "Company users. Roles map as Manager=Admin, Supervisor=Planner, Operator=Execution. Unique ID required for each record.",
    headers: ["EMPLOYEE ID", "FULL NAME", "EMAIL", "PHONE", "ROLE", "ACTIVE"],
    rows: [
      ["EMP-001", "Alex Rivera", "alex.rivera@example.com", "+919024218889", "Manager", "YES"],
      ["EMP-002", "Neha Shah", "neha.shah@example.com", "+919024218890", "Supervisor", "YES"],
      ["EMP-003", "Ravi Patel", "ravi.patel@example.com", "+919024218891", "Operator", "YES"],
    ],
  },
  {
    name: SHEETS.kaizen,
    description: "Kaizen/suggestion categories used by kaizen module dropdowns and report mapping. Upload values only — unique ID is not required.",
    headers: ["KAIZEN CATEGORY", "DEPARTMENT", "STATUS", "IMMEDIATE ACTION REQUIRED", "NOTES"],
    rows: [
      ["Process Improvement", "Maintenance", "Open", "NO", "General improvement idea"],
      ["Safety Improvement", "Safety", "Open", "YES", "Use when immediate correction is required"],
    ],
  },
  {
    name: SHEETS.locations,
    description: "Plant hierarchy, shift details, departments, and location dropdowns. Upload values only — unique ID is not required.",
    headers: ["SECTION", "LOCATION", "AREA SUPERVISOR", "SHIFT DETAILS", "DEPARTMENT"],
    rows: [
      ["Utilities", "Compressor Room", "Neha Shah", "A Shift", "Maintenance"],
      ["Press Shop", "Press Bay 1", "Amit Desai", "B Shift", "Production"],
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
