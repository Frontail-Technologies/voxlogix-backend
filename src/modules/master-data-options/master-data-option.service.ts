import { and, asc, eq, inArray } from "drizzle-orm";

import { db } from "@/db";
import {
  admins,
  equipmentAssets,
  issueCategories,
  kaizenCategories,
  locations,
  measuringPoints,
  meterCounters,
  safetyReportingMasters,
} from "@/db/schema";
import { USER_ROLES, USER_STATUS } from "@/shared/constants";

export type MasterDataSourceKey =
  | "equipment_master"
  | "issue_categories"
  | "safety_reporting"
  | "measuring_points"
  | "meter_counters"
  | "users_roles"
  | "sections_locations_shift"
  | "kaizen";

export type MasterDataOption = {
  value: string;
  label: string;
  meta?: Record<string, unknown>;
};

type ListMasterDataOptionsInput = {
  companyId: string;
  sourceKey: MasterDataSourceKey;
  fieldKey?: string;
};

function uniqueOptions(values: Array<string | null | undefined>): MasterDataOption[] {
  const seen = new Set<string>();
  const options: MasterDataOption[] = [];

  for (const rawValue of values) {
    const value = rawValue?.trim();
    if (!value || seen.has(value.toLowerCase())) continue;
    seen.add(value.toLowerCase());
    options.push({ value, label: value });
  }

  return options;
}

function yesNoOptions(values: Array<string | null | undefined>) {
  const options = uniqueOptions(values.map((value) => value?.toUpperCase()));
  return options.length ? options : ["No", "Yes"].map((value) => ({ value, label: value }));
}

export async function listMasterDataOptions(input: ListMasterDataOptionsInput): Promise<MasterDataOption[]> {
  const fieldKey = input.fieldKey?.trim();

  if (input.sourceKey === "equipment_master") {
    const rows = await db
      .select({
        id: equipmentAssets.id,
        equipmentCode: equipmentAssets.equipmentCode,
        name: equipmentAssets.name,
        section: equipmentAssets.section,
        subLocation: equipmentAssets.subLocation,
        criticality: equipmentAssets.criticality,
      })
      .from(equipmentAssets)
      .where(and(eq(equipmentAssets.companyId, input.companyId), eq(equipmentAssets.status, "ACTIVE")))
      .orderBy(asc(equipmentAssets.equipmentCode));

    return rows.map((row) => ({
      value: `${row.equipmentCode} - ${row.name}`,
      label: `${row.equipmentCode} - ${row.name}`,
      meta: row,
    }));
  }

  if (input.sourceKey === "issue_categories") {
    const rows = await db
      .select({
        id: issueCategories.id,
        name: issueCategories.name,
        moduleType: issueCategories.moduleType,
        severityDefault: issueCategories.severityDefault,
        equipmentFunction: issueCategories.equipmentFunction,
        failureMode: issueCategories.failureMode,
        maintenanceType: issueCategories.maintenanceType,
        productionImpact: issueCategories.productionImpact,
      })
      .from(issueCategories)
      .where(and(eq(issueCategories.companyId, input.companyId), eq(issueCategories.status, "ACTIVE")))
      .orderBy(asc(issueCategories.name));

    if (fieldKey === "severity") return uniqueOptions(rows.map((row) => row.severityDefault));
    if (fieldKey === "equipmentFunction") return uniqueOptions(rows.map((row) => row.equipmentFunction));
    if (fieldKey === "failureMode") return uniqueOptions(rows.map((row) => row.failureMode));
    if (fieldKey === "maintenanceType") return uniqueOptions(rows.map((row) => row.maintenanceType));
    if (fieldKey === "productionImpact") return uniqueOptions(rows.map((row) => row.productionImpact));

    return rows.map((row) => ({
      value: row.name,
      label: row.name,
      meta: row,
    }));
  }

  if (input.sourceKey === "safety_reporting") {
    const rows = await db
      .select({
        id: safetyReportingMasters.id,
        incidentCategory: safetyReportingMasters.incidentCategory,
        incidentType: safetyReportingMasters.incidentType,
        severityLevel: safetyReportingMasters.severityLevel,
        requiresPpe: safetyReportingMasters.requiresPpe,
        ppeType: safetyReportingMasters.ppeType,
        reportable: safetyReportingMasters.reportable,
        immediateActionRequired: safetyReportingMasters.immediateActionRequired,
      })
      .from(safetyReportingMasters)
      .where(and(eq(safetyReportingMasters.companyId, input.companyId), eq(safetyReportingMasters.status, "ACTIVE")))
      .orderBy(asc(safetyReportingMasters.incidentCategory), asc(safetyReportingMasters.incidentType));

    if (fieldKey === "safetyCategory") return uniqueOptions(rows.map((row) => row.incidentCategory));
    if (fieldKey === "incidentType") return uniqueOptions(rows.map((row) => row.incidentType));
    if (fieldKey === "severity") return uniqueOptions(rows.map((row) => row.severityLevel));
    if (fieldKey === "ppeRequired") return yesNoOptions(rows.map((row) => row.requiresPpe));
    if (fieldKey === "ppeType") return uniqueOptions(rows.map((row) => row.ppeType));
    if (fieldKey === "reportable") return yesNoOptions(rows.map((row) => row.reportable));
    if (fieldKey === "immediateActionRequired") return yesNoOptions(rows.map((row) => row.immediateActionRequired));

    return rows.map((row) => ({
      value: `${row.incidentCategory} - ${row.incidentType}`,
      label: `${row.incidentCategory} - ${row.incidentType}`,
      meta: row,
    }));
  }

  if (input.sourceKey === "measuring_points") {
    const rows = await db
      .select({
        id: measuringPoints.id,
        pointCode: measuringPoints.pointCode,
        measurementName: measuringPoints.measurementName,
        measurementUnit: measuringPoints.measurementUnit,
        lowerLimit: measuringPoints.lowerLimit,
        upperLimit: measuringPoints.upperLimit,
        alertSeverity: measuringPoints.alertSeverity,
      })
      .from(measuringPoints)
      .where(and(eq(measuringPoints.companyId, input.companyId), eq(measuringPoints.status, "ACTIVE")))
      .orderBy(asc(measuringPoints.pointCode));

    if (fieldKey === "unit") return uniqueOptions(rows.map((row) => row.measurementUnit));

    return rows.map((row) => ({
      value: `${row.pointCode} - ${row.measurementName}`,
      label: `${row.pointCode} - ${row.measurementName}`,
      meta: row,
    }));
  }

  if (input.sourceKey === "meter_counters") {
    const rows = await db
      .select({
        id: meterCounters.id,
        counterCode: meterCounters.counterCode,
        counterName: meterCounters.counterName,
        counterUnit: meterCounters.counterUnit,
        meterType: meterCounters.meterType,
        expectedDailyConsumption: meterCounters.expectedDailyConsumption,
        alertDeviationPct: meterCounters.alertDeviationPct,
      })
      .from(meterCounters)
      .where(and(eq(meterCounters.companyId, input.companyId), eq(meterCounters.status, "ACTIVE")))
      .orderBy(asc(meterCounters.counterCode));

    if (fieldKey === "unit") return uniqueOptions(rows.map((row) => row.counterUnit));
    if (fieldKey === "meterType") return uniqueOptions(rows.map((row) => row.meterType));

    return rows.map((row) => ({
      value: `${row.counterCode} - ${row.counterName}`,
      label: `${row.counterCode} - ${row.counterName}`,
      meta: row,
    }));
  }

  if (input.sourceKey === "users_roles") {
    const rows = await db
      .select({ id: admins.id, fullName: admins.fullName, role: admins.role, email: admins.email })
      .from(admins)
      .where(
        and(
          eq(admins.companyId, input.companyId),
          eq(admins.status, USER_STATUS.ACTIVE),
          inArray(admins.role, [USER_ROLES.ADMIN, USER_ROLES.PLANNER, USER_ROLES.EXECUTION]),
        ),
      )
      .orderBy(asc(admins.fullName));

    return rows.map((row) => ({
      value: row.fullName,
      label: `${row.fullName} (${row.role.toLowerCase()})`,
      meta: row,
    }));
  }

  if (input.sourceKey === "sections_locations_shift") {
    const rows = await db
      .select({
        id: locations.id,
        plant: locations.plant,
        unit: locations.unit,
        section: locations.section,
        subLocation: locations.subLocation,
        shiftDetails: locations.shiftDetails,
        department: locations.department,
      })
      .from(locations)
      .where(and(eq(locations.companyId, input.companyId), eq(locations.status, "ACTIVE")))
      .orderBy(asc(locations.section), asc(locations.subLocation));

    if (fieldKey === "shift") return uniqueOptions(rows.map((row) => row.shiftDetails));
    if (fieldKey === "section") return uniqueOptions(rows.map((row) => row.section));
    if (fieldKey === "subLocation") return uniqueOptions(rows.map((row) => row.subLocation));
    if (fieldKey === "department") return uniqueOptions(rows.map((row) => row.department));

    return rows.map((row) => ({
      value: `${row.section} / ${row.subLocation}`,
      label: `${row.section} / ${row.subLocation}`,
      meta: row,
    }));
  }

  const rows = await db
    .select({
      id: kaizenCategories.id,
      category: kaizenCategories.category,
      department: kaizenCategories.department,
      kaizenStatus: kaizenCategories.kaizenStatus,
      immediateActionRequired: kaizenCategories.immediateActionRequired,
    })
    .from(kaizenCategories)
    .where(and(eq(kaizenCategories.companyId, input.companyId), eq(kaizenCategories.status, "ACTIVE")))
    .orderBy(asc(kaizenCategories.category));

  if (fieldKey === "department") return uniqueOptions(rows.map((row) => row.department));
  if (fieldKey === "status") return uniqueOptions(rows.map((row) => row.kaizenStatus));
  if (fieldKey === "immediateActionRequired") return yesNoOptions(rows.map((row) => row.immediateActionRequired));

  return rows.map((row) => ({
    value: row.category,
    label: row.category,
    meta: row,
  }));
}
