import {
  buildOutputReportDataset,
  parseReportRange,
} from "@/modules/reports/output-report.service";
import type { OutputReportContext, OutputReportDataset, SheetRow } from "@/modules/reports/output-report.types";
import type { KpiDashboardDto } from "@/modules/reports/kpi-dashboard.types";

const CLOSED_KAIZEN_STATUSES = new Set(["closed", "implemented"]);
const PLANNED_MAINTENANCE_TYPES = new Set(["preventive", "predictive", "inspection round"]);
const BREAKDOWN_MAINTENANCE_TYPE = "breakdown";
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * KPI definitions:
 * - MTTR: average logged Downtime Hours for Equipment Log rows with numeric downtime.
 * - MTBF Proxy: average days between logged Equipment failures, not operating-hour MTBF.
 * - Repeat failure identity: Equipment ID + Equipment Function + Failure Mode.
 * - Planned maintenance: Preventive + Predictive + Inspection Round over total Equipment Logs.
 * - Reportable safety: Reportable YES over known YES/NO reportability, unknown tracked separately.
 * - Measuring out-of-limit: OUT OF LIMIT readings over all Measuring Point readings.
 * - Meter deviation: signed average of stored deviation percentages; high flag uses stored status.
 * - Kaizen closure: Closed + Implemented over total Kaizen logs; Rejected is not counted as closed.
 */
export async function getKpiDashboard(input: OutputReportContext): Promise<KpiDashboardDto> {
  const dataset = await buildOutputReportDataset(input);
  return buildKpiDashboard(dataset);
}

export function buildKpiDashboard(dataset: OutputReportDataset): KpiDashboardDto {
  const equipmentRows = dataset.equipmentRows;
  const safetyRows = dataset.safetyRows;
  const measuringRows = dataset.measuringPointRows;
  const counterRows = dataset.meterCounterRows;
  const kaizenRows = dataset.kaizenRows;

  const totalDowntimeHours = round(sum(equipmentRows.map((row) => numberValue(row["Downtime Hours"]))));
  const downtimeValues = equipmentRows
    .map((row) => numberValue(row["Downtime Hours"]))
    .filter((value): value is number => value !== null);
  const averageDowntimeHours = average(downtimeValues);
  const breakdownRows = equipmentRows.filter((row) => normalize(row["Maintenance Type"]) === BREAKDOWN_MAINTENANCE_TYPE);
  const plannedMaintenancePercent = percent(
    equipmentRows.filter((row) => PLANNED_MAINTENANCE_TYPES.has(normalize(row["Maintenance Type"]))).length,
    equipmentRows.length,
  );
  const criticalHighSafetyRows = safetyRows.filter((row) => ["critical", "high"].includes(normalize(row.Severity)));
  const outOfLimitRows = measuringRows.filter((row) => normalize(row["Out of Limit Flag"]) === "out of limit");
  const highDeviationRows = counterRows.filter((row) => normalize(row["Deviation Flag"]) === "high deviation");

  return {
    period: { fromDate: dataset.range.fromDate, toDate: dataset.range.toDate },
    company: { id: dataset.company.id, name: dataset.company.name },
    generatedAt: dataset.generatedAt.toISOString(),
    summary: {
      totalEquipmentLogs: equipmentRows.length,
      totalDowntimeHours,
      averageDowntimeHours,
      breakdownCount: breakdownRows.length,
      plannedMaintenancePercent,
      safetyIncidents: safetyRows.length,
      criticalHighSafetyIncidents: criticalHighSafetyRows.length,
      outOfLimitMeasurements: outOfLimitRows.length,
      highDeviationCounterReadings: highDeviationRows.length,
      kaizenSubmitted: kaizenRows.length,
      kaizenClosureRate: percent(
        kaizenRows.filter((row) => CLOSED_KAIZEN_STATUSES.has(normalize(row.Status))).length,
        kaizenRows.length,
      ),
    },
    mttrByEquipmentCategory: mttrByEquipmentCategory(equipmentRows),
    downtimeBySection: downtimeBySection(equipmentRows, totalDowntimeHours),
    repeatFailures: repeatFailures(equipmentRows),
    mtbfProxyByEquipment: mtbfProxyByEquipment(equipmentRows),
    maintenanceTypeDistribution: maintenanceTypeDistribution(equipmentRows, plannedMaintenancePercent),
    productionImpactBreakdowns: productionImpactBreakdowns(breakdownRows),
    safetyMonthlyTrend: safetyMonthlyTrend(safetyRows, dataset.range.from, dataset.range.to),
    safetySeverityDistribution: safetySeverityDistribution(safetyRows),
    reportableSafety: reportableSafety(safetyRows),
    measuringPointOutOfLimit: measuringPointOutOfLimit(measuringRows),
    meterCounterDeviation: meterCounterDeviation(counterRows),
    kaizenStatusFunnel: kaizenStatusFunnel(kaizenRows),
    kaizenByCategory: kaizenByCategory(kaizenRows),
  };
}

export function parseKpiRange(fromDate: string, toDate: string) {
  return parseReportRange(fromDate, toDate);
}

function mttrByEquipmentCategory(rows: SheetRow[]) {
  const grouped = groupBy(rows, (row) => stringValue(row["Equipment Category"]) || "Unknown");
  return [...grouped.entries()]
    .map(([equipmentCategory, categoryRows]) => {
      const values = categoryRows
        .map((row) => numberValue(row["Downtime Hours"]))
        .filter((value): value is number => value !== null);
      return {
        equipmentCategory,
        averageDowntimeHours: average(values) ?? 0,
        breakdownCount: values.length,
      };
    })
    .filter((item) => item.breakdownCount > 0)
    .sort((a, b) => b.averageDowntimeHours - a.averageDowntimeHours || a.equipmentCategory.localeCompare(b.equipmentCategory));
}

function downtimeBySection(rows: SheetRow[], totalDowntimeHours: number) {
  return [...groupBy(rows, (row) => stringValue(row.Section) || "Unknown").entries()]
    .map(([section, sectionRows]) => {
      const sectionDowntime = round(sum(sectionRows.map((row) => numberValue(row["Downtime Hours"]))));
      return {
        section,
        totalDowntimeHours: sectionDowntime,
        percentageOfTotalDowntime: percent(sectionDowntime, totalDowntimeHours),
      };
    })
    .filter((item) => item.totalDowntimeHours > 0)
    .sort((a, b) => b.totalDowntimeHours - a.totalDowntimeHours || a.section.localeCompare(b.section));
}

function repeatFailures(rows: SheetRow[]) {
  const grouped = groupBy(
    rows.filter((row) => {
      return stringValue(row["Equipment ID"]) && stringValue(row["Equipment Function"]) && stringValue(row["Failure Mode"]);
    }),
    (row) => [
      stringValue(row["Equipment ID"]),
      stringValue(row["Equipment Function"]),
      stringValue(row["Failure Mode"]),
    ].map(normalize).join("|"),
  );

  return [...grouped.values()]
    .map((groupRows) => {
      const row = groupRows[0];
      return {
        equipmentId: stringValue(row["Equipment ID"]),
        equipmentName: stringValue(row["Equipment Name"]),
        equipmentFunction: stringValue(row["Equipment Function"]),
        failureMode: stringValue(row["Failure Mode"]),
        occurrenceCount: groupRows.length,
      };
    })
    .filter((item) => item.occurrenceCount > 1)
    .sort((a, b) => b.occurrenceCount - a.occurrenceCount || a.equipmentId.localeCompare(b.equipmentId))
    .slice(0, 10);
}

function mtbfProxyByEquipment(rows: SheetRow[]) {
  const grouped = groupBy(
    rows.filter((row) => stringValue(row["Equipment ID"])),
    (row) => stringValue(row["Equipment ID"]),
  );

  return [...grouped.values()]
    .map((groupRows) => {
      const sorted = [...groupRows].sort((a, b) => dateValue(a["Reported Date"]).getTime() - dateValue(b["Reported Date"]).getTime());
      const intervals: number[] = [];
      for (let index = 1; index < sorted.length; index += 1) {
        intervals.push(daysBetween(dateValue(sorted[index - 1]["Reported Date"]), dateValue(sorted[index]["Reported Date"])));
      }
      const row = sorted[0];
      return {
        equipmentId: stringValue(row["Equipment ID"]),
        equipmentName: stringValue(row["Equipment Name"]),
        averageDaysBetweenFailures: average(intervals),
        failureCount: sorted.length,
      };
    })
    .filter((item) => item.averageDaysBetweenFailures !== null)
    .sort((a, b) => (a.averageDaysBetweenFailures ?? 0) - (b.averageDaysBetweenFailures ?? 0) || a.equipmentId.localeCompare(b.equipmentId))
    .slice(0, 10);
}

function maintenanceTypeDistribution(rows: SheetRow[], plannedMaintenancePercent: number | null) {
  return {
    plannedMaintenancePercent,
    totalEquipmentLogs: rows.length,
    items: countDistribution(rows, (row) => stringValue(row["Maintenance Type"]) || "Unknown", rows.length, "maintenanceType"),
  };
}

function productionImpactBreakdowns(rows: SheetRow[]) {
  return {
    totalBreakdowns: rows.length,
    items: countDistribution(rows, (row) => stringValue(row["Production Impact"]) || "Unknown", rows.length, "productionImpact").map((item) => ({
      productionImpact: item.productionImpact,
      count: item.count,
      percentageOfBreakdowns: item.percentageOfTotal,
    })),
  };
}

function safetyMonthlyTrend(rows: SheetRow[], from: Date, to: Date) {
  const buckets = continuousMonthBuckets(from, to);
  for (const row of rows) {
    const month = monthLabel(dateValue(row["Reported Date"]));
    const bucket = buckets.get(month);
    if (!bucket) continue;
    bucket.incidentCount += 1;
    if (["critical", "high"].includes(normalize(row.Severity))) {
      bucket.criticalHighSeverityCount += 1;
    }
  }
  return [...buckets.values()];
}

function safetySeverityDistribution(rows: SheetRow[]) {
  return countDistribution(rows, (row) => stringValue(row.Severity) || "Unknown", rows.length, "severity").map((item) => ({
    severity: item.severity,
    incidentCount: item.count,
    percentageOfTotal: item.percentageOfTotal,
  }));
}

function reportableSafety(rows: SheetRow[]) {
  let reportableCount = 0;
  let knownReportabilityCount = 0;
  let unknownReportabilityCount = 0;

  for (const row of rows) {
    const value = normalize(row["Reportable (Factories Act)"]);
    if (!value) {
      unknownReportabilityCount += 1;
      continue;
    }
    if (value === "yes") reportableCount += 1;
    if (value === "yes" || value === "no") knownReportabilityCount += 1;
    if (value !== "yes" && value !== "no") unknownReportabilityCount += 1;
  }

  return {
    reportableCount,
    totalSafetyIncidents: rows.length,
    knownReportabilityCount,
    unknownReportabilityCount,
    reportablePercent: percent(reportableCount, knownReportabilityCount),
  };
}

function measuringPointOutOfLimit(rows: SheetRow[]) {
  const items = [...groupBy(rows, (row) => stringValue(row["Measurement Name"]) || "Unknown").entries()]
    .map(([measurementName, measurementRows]) => {
      const outOfLimitCount = measurementRows.filter((row) => normalize(row["Out of Limit Flag"]) === "out of limit").length;
      return {
        measurementName,
        totalReadings: measurementRows.length,
        outOfLimitCount,
        outOfLimitPercent: percent(outOfLimitCount, measurementRows.length),
      };
    })
    .sort((a, b) => (b.outOfLimitPercent ?? 0) - (a.outOfLimitPercent ?? 0) || b.outOfLimitCount - a.outOfLimitCount || a.measurementName.localeCompare(b.measurementName));

  const totalOutOfLimitReadings = rows.filter((row) => normalize(row["Out of Limit Flag"]) === "out of limit").length;
  return {
    totalMeasurementReadings: rows.length,
    totalOutOfLimitReadings,
    overallOutOfLimitPercent: percent(totalOutOfLimitReadings, rows.length),
    items,
  };
}

function meterCounterDeviation(rows: SheetRow[]) {
  const items = [...groupBy(rows, (row) => `${stringValue(row["Counter ID"])}|${stringValue(row["Counter Name"])}`).entries()]
    .map(([, counterRows]) => {
      const first = counterRows[0];
      const deviations = counterRows
        .map((row) => numberValue(row["Deviation % (vs Expected)"]))
        .filter((value): value is number => value !== null);
      return {
        counterId: stringValue(first["Counter ID"]),
        counterName: stringValue(first["Counter Name"]) || "Unknown",
        averageDeviationPercent: average(deviations),
        highDeviationCount: counterRows.filter((row) => normalize(row["Deviation Flag"]) === "high deviation").length,
        readingCount: counterRows.length,
      };
    })
    .sort((a, b) => (b.highDeviationCount - a.highDeviationCount) || Math.abs(b.averageDeviationPercent ?? 0) - Math.abs(a.averageDeviationPercent ?? 0) || a.counterName.localeCompare(b.counterName));

  return {
    totalCounterReadings: rows.length,
    highDeviationCount: rows.filter((row) => normalize(row["Deviation Flag"]) === "high deviation").length,
    items,
  };
}

function kaizenStatusFunnel(rows: SheetRow[]) {
  return {
    totalKaizen: rows.length,
    closureRate: percent(rows.filter((row) => CLOSED_KAIZEN_STATUSES.has(normalize(row.Status))).length, rows.length),
    items: countDistribution(rows, (row) => stringValue(row.Status) || "Unknown", rows.length, "status").map((item) => ({
      status: item.status,
      count: item.count,
    })),
  };
}

function kaizenByCategory(rows: SheetRow[]) {
  return countDistribution(rows, (row) => stringValue(row["Kaizen Category"]) || "Unknown", rows.length, "category");
}

function countDistribution<TKey extends string>(
  rows: SheetRow[],
  keyOf: (row: SheetRow) => string,
  total: number,
  keyName: TKey,
) {
  const grouped = groupBy(rows, keyOf);
  return [...grouped.entries()]
    .map(([key, values]) => ({
      [keyName]: key,
      count: values.length,
      percentageOfTotal: percent(values.length, total),
    }) as Record<TKey, string> & { count: number; percentageOfTotal: number | null })
    .sort((a, b) => b.count - a.count || String(a[keyName]).localeCompare(String(b[keyName])));
}

function groupBy<T>(rows: T[], keyOf: (row: T) => string) {
  const grouped = new Map<string, T[]>();
  for (const row of rows) {
    const key = keyOf(row);
    grouped.set(key, [...(grouped.get(key) ?? []), row]);
  }
  return grouped;
}

function sum(values: Array<number | null>): number {
  return values.reduce<number>((total, value) => total + (value ?? 0), 0);
}

function average(values: number[]) {
  if (values.length === 0) return null;
  return round(values.reduce((total, value) => total + value, 0) / values.length);
}

function percent(part: number, total: number) {
  if (!total) return null;
  return round(part / total);
}

function round(value: number) {
  return Number(value.toFixed(4));
}

function stringValue(value: SheetRow[string]) {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return value.toISOString();
  return String(value).trim();
}

function numberValue(value: SheetRow[string]) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function dateValue(value: SheetRow[string]) {
  if (value instanceof Date) return value;
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? new Date(0) : date;
}

function normalize(value: SheetRow[string]) {
  return stringValue(value).toLowerCase().replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();
}

function monthLabel(date: Date) {
  return `${MONTHS[date.getMonth()]}-${date.getFullYear()}`;
}

function continuousMonthBuckets(from: Date, to: Date) {
  const buckets = new Map<string, { month: string; incidentCount: number; criticalHighSeverityCount: number }>();
  const cursor = new Date(from.getFullYear(), from.getMonth(), 1);
  const end = new Date(to.getFullYear(), to.getMonth(), 1);

  while (cursor <= end) {
    const month = monthLabel(cursor);
    buckets.set(month, { month, incidentCount: 0, criticalHighSeverityCount: 0 });
    cursor.setMonth(cursor.getMonth() + 1);
  }

  return buckets;
}

function daysBetween(from: Date, to: Date) {
  return Math.max(0, Math.floor((startOfLocalDay(to).getTime() - startOfLocalDay(from).getTime()) / MS_PER_DAY));
}

function startOfLocalDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}
