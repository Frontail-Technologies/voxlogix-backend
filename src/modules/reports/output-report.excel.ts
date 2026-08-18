import ExcelJS from "exceljs";

import { buildKpiDashboard } from "@/modules/reports/kpi-dashboard.service";
import type { KpiDashboardDto } from "@/modules/reports/kpi-dashboard.types";
import {
  EQUIPMENT_LOG_COLUMNS,
  KAIZEN_LOG_COLUMNS,
  MASTER_LOG_COLUMNS,
  MEASURING_POINTS_LOG_COLUMNS,
  METER_COUNTERS_LOG_COLUMNS,
  OUTPUT_REPORT_SHEETS,
  SAFETY_LOG_COLUMNS,
  SHIFT_LOG_COLUMNS,
} from "@/modules/reports/output-report.constants";
import type { OutputReportDataset, SheetRow } from "@/modules/reports/output-report.types";

type ColumnName = string;

const numericColumns = new Set([
  "Downtime Hours",
  "Time Duration Hours",
  "Measured Value",
  "Target Value",
  "Lower Limit",
  "Upper Limit",
  "Previous Reading",
  "Current Reading",
  "Expected Consumption (for period)",
  "Days Since Last Reading",
  "Consumption Delta",
  "Attachments Count",
]);

const percentageColumns = new Set([
  "Deviation % (vs Target)",
  "Deviation % (vs Expected)",
]);

export async function buildOutputReportWorkbook(dataset: OutputReportDataset) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "VoxLogiX";
  workbook.created = dataset.generatedAt;
  workbook.modified = dataset.generatedAt;

  addReadMeSheet(workbook, dataset);
  addDataSheet(workbook, OUTPUT_REPORT_SHEETS.equipment, EQUIPMENT_LOG_COLUMNS, dataset.equipmentRows);
  addDataSheet(workbook, OUTPUT_REPORT_SHEETS.safety, SAFETY_LOG_COLUMNS, dataset.safetyRows);
  addDataSheet(workbook, OUTPUT_REPORT_SHEETS.measuringPoints, MEASURING_POINTS_LOG_COLUMNS, dataset.measuringPointRows);
  addDataSheet(workbook, OUTPUT_REPORT_SHEETS.meterCounters, METER_COUNTERS_LOG_COLUMNS, dataset.meterCounterRows);
  addDataSheet(workbook, OUTPUT_REPORT_SHEETS.shift, SHIFT_LOG_COLUMNS, dataset.shiftRows);
  addDataSheet(workbook, OUTPUT_REPORT_SHEETS.kaizen, KAIZEN_LOG_COLUMNS, dataset.kaizenRows);
  addDataSheet(workbook, OUTPUT_REPORT_SHEETS.master, MASTER_LOG_COLUMNS, dataset.masterRows);
  addKpiDashboardSheet(workbook, buildKpiDashboard(dataset));

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

export function outputReportFilename(fromDate: string, toDate: string, companyName?: string) {
  const companyPart = companyName ? `${sanitizeFilename(companyName)}_` : "";
  return `${companyPart}VoxLogiX_Output_Report_${fromDate}_to_${toDate}.xlsx`;
}

function addReadMeSheet(workbook: ExcelJS.Workbook, dataset: OutputReportDataset) {
  const sheet = workbook.addWorksheet(OUTPUT_REPORT_SHEETS.readMe, {
    views: [{ state: "frozen", ySplit: 1 }],
  });

  sheet.columns = [{ width: 32 }, { width: 80 }];
  const rows = [
    ["VoxLogiX - Maintenance & Reliability Output Report", ""],
    ["Company", dataset.company.name],
    ["From Date", dataset.range.fromDate],
    ["To Date", dataset.range.toDate],
    ["Generated At", dataset.generatedAt],
    ["", ""],
    ["Sheets", "Purpose"],
    [OUTPUT_REPORT_SHEETS.equipment, "Equipment voice/log records with maintenance helper fields."],
    [OUTPUT_REPORT_SHEETS.safety, "Safety records and available safety master snapshots."],
    [OUTPUT_REPORT_SHEETS.measuringPoints, "All measuring point readings, including normal readings."],
    [OUTPUT_REPORT_SHEETS.meterCounters, "All meter counter readings, including normal readings."],
    [OUTPUT_REPORT_SHEETS.shift, "Shift log records. Equipment is optional."],
    [OUTPUT_REPORT_SHEETS.kaizen, "Kaizen/suggestion records."],
    [OUTPUT_REPORT_SHEETS.master, "Chronological consolidation of all exported records."],
    [OUTPUT_REPORT_SHEETS.kpiDashboard, "Backend-computed KPI dashboard tables for the selected period."],
  ];

  sheet.addRows(rows);
  sheet.getRow(1).font = { bold: true, size: 14, color: { argb: "FF0F172A" } };
  sheet.getRow(7).font = { bold: true };
  sheet.getRow(7).fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFFFB91C" },
  };
  sheet.getCell("B5").numFmt = "dd-mm-yyyy hh:mm";
  applyBorders(sheet);
}

function addKpiDashboardSheet(workbook: ExcelJS.Workbook, kpi: KpiDashboardDto) {
  const sheet = workbook.addWorksheet(OUTPUT_REPORT_SHEETS.kpiDashboard, {
    views: [{ state: "frozen", ySplit: 5 }],
  });

  sheet.columns = [
    { width: 34 },
    { width: 20 },
    { width: 20 },
    { width: 20 },
    { width: 20 },
  ];

  sheet.mergeCells("A1:E1");
  sheet.getCell("A1").value = "VoxLogiX KPI Dashboard";
  sheet.getCell("A1").font = { bold: true, size: 16, color: { argb: "FF0F172A" } };
  sheet.getCell("A1").alignment = { horizontal: "center" };
  sheet.addRow(["Company", kpi.company.name, "From", kpi.period.fromDate, "To", kpi.period.toDate]);
  sheet.addRow(["Generated At", new Date(kpi.generatedAt)]);
  sheet.getCell("B3").numFmt = "dd-mm-yyyy hh:mm";
  sheet.addRow([]);

  addSection(sheet, "Summary", ["Metric", "Value"], [
    ["Equipment Logs", kpi.summary.totalEquipmentLogs],
    ["Total Downtime Hours", kpi.summary.totalDowntimeHours],
    ["MTTR Proxy Hours", kpi.summary.averageDowntimeHours],
    ["Breakdown Count", kpi.summary.breakdownCount],
    ["Planned Maintenance %", kpi.summary.plannedMaintenancePercent],
    ["Safety Incidents", kpi.summary.safetyIncidents],
    ["Critical + High Safety Incidents", kpi.summary.criticalHighSafetyIncidents],
    ["Out-of-Limit Measurements", kpi.summary.outOfLimitMeasurements],
    ["High-Deviation Counter Readings", kpi.summary.highDeviationCounterReadings],
    ["Kaizen Submitted", kpi.summary.kaizenSubmitted],
    ["Kaizen Closure Rate", kpi.summary.kaizenClosureRate],
  ], { percentCells: [{ rowIndex: 5, columnNumber: 2 }, { rowIndex: 11, columnNumber: 2 }] });

  addSection(sheet, "1. Mean Time To Repair (MTTR) by Equipment Category", ["Equipment Category", "Avg Downtime Hours", "Breakdown Count"], kpi.mttrByEquipmentCategory.map((row) => [row.equipmentCategory, row.averageDowntimeHours, row.breakdownCount]));
  addSection(sheet, "2. Total Downtime Hours by Section", ["Section", "Total Downtime Hours", "% of Total"], kpi.downtimeBySection.map((row) => [row.section, row.totalDowntimeHours, row.percentageOfTotalDowntime]), { percentColumns: [3] });
  addSection(sheet, "3. Top Repeat Failures", ["Equipment ID", "Equipment Name", "Function", "Failure Mode", "Occurrences"], kpi.repeatFailures.map((row) => [row.equipmentId, row.equipmentName, row.equipmentFunction, row.failureMode, row.occurrenceCount]));
  addSection(sheet, "4. Mean Time Between Failures (MTBF) proxy", ["Equipment ID", "Equipment Name", "Avg Days Between Failures", "Failure Count"], kpi.mtbfProxyByEquipment.map((row) => [row.equipmentId, row.equipmentName, row.averageDaysBetweenFailures, row.failureCount]));
  addSection(sheet, "5. Planned vs Unplanned Maintenance Ratio", ["Maintenance Type", "Count", "% of Total"], kpi.maintenanceTypeDistribution.items.map((row) => [row.maintenanceType, row.count, row.percentageOfTotal]), { percentColumns: [3] });
  addSection(sheet, "6. Production Impact of Breakdowns", ["Production Impact", "Count", "% of Breakdowns"], kpi.productionImpactBreakdowns.items.map((row) => [row.productionImpact, row.count, row.percentageOfBreakdowns]), { percentColumns: [3] });
  addSection(sheet, "7. Safety Incident Count by Month", ["Month", "Incidents", "Critical/High"], kpi.safetyMonthlyTrend.map((row) => [row.month, row.incidentCount, row.criticalHighSeverityCount]));
  addSection(sheet, "8. Safety Incident Severity Distribution", ["Severity", "Incidents", "% of Total"], kpi.safetySeverityDistribution.map((row) => [row.severity, row.incidentCount, row.percentageOfTotal]), { percentColumns: [3] });
  addSection(sheet, "9. Reportable Incidents Summary", ["Metric", "Value"], [
    ["Reportable Incidents", kpi.reportableSafety.reportableCount],
    ["Total Safety Incidents", kpi.reportableSafety.totalSafetyIncidents],
    ["Known Reportability", kpi.reportableSafety.knownReportabilityCount],
    ["Unknown Reportability", kpi.reportableSafety.unknownReportabilityCount],
    ["Reportable %", kpi.reportableSafety.reportablePercent],
  ], { percentCells: [{ rowIndex: 5, columnNumber: 2 }] });
  addSection(sheet, "10. Condition Monitoring - Out-of-Limit Frequency", ["Measurement", "Total", "Out of Limit", "% Out of Limit"], kpi.measuringPointOutOfLimit.items.map((row) => [row.measurementName, row.totalReadings, row.outOfLimitCount, row.outOfLimitPercent]), { percentColumns: [4] });
  addSection(sheet, "11. Utility/Meter Counter - Avg Consumption Deviation %", ["Counter ID", "Counter", "Avg Deviation %", "High-Deviation Count", "Readings"], kpi.meterCounterDeviation.items.map((row) => [row.counterId, row.counterName, row.averageDeviationPercent, row.highDeviationCount, row.readingCount]), { percentColumns: [3] });
  addSection(sheet, "12. Continuous Improvement - Kaizen Status Funnel", ["Status", "Count"], kpi.kaizenStatusFunnel.items.map((row) => [row.status, row.count]));
  addSection(sheet, "13. Kaizen Submissions by Category", ["Category", "Count", "% of Total"], kpi.kaizenByCategory.map((row) => [row.category, row.count, row.percentageOfTotal]), { percentColumns: [3] });

  applyBorders(sheet);
}

function addSection(
  sheet: ExcelJS.Worksheet,
  title: string,
  headers: string[],
  rows: Array<Array<string | number | null>>,
  options: { percentColumns?: number[]; percentCells?: Array<{ rowIndex: number; columnNumber: number }> } = {},
) {
  const titleRow = sheet.addRow([title]);
  titleRow.font = { bold: true, size: 12, color: { argb: "FF0F172A" } };
  titleRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF8FAFC" } };
  sheet.addRow(headers);
  const headerRow = sheet.getRow(sheet.rowCount);
  headerRow.font = { bold: true, color: { argb: "FF111827" } };
  headerRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFB91C" } };

  const firstDataRow = sheet.rowCount + 1;
  if (rows.length === 0) {
    sheet.addRow(["No data"]);
  } else {
    for (const row of rows) sheet.addRow(row);
  }

  const percentColumns = new Set(options.percentColumns ?? []);
  for (let rowNumber = firstDataRow; rowNumber <= sheet.rowCount; rowNumber += 1) {
    for (const columnNumber of percentColumns) {
      sheet.getCell(rowNumber, columnNumber).numFmt = "0.00%";
    }
  }
  for (const cell of options.percentCells ?? []) {
    sheet.getCell(firstDataRow + cell.rowIndex - 1, cell.columnNumber).numFmt = "0.00%";
  }
  sheet.addRow([]);
}

function addDataSheet(
  workbook: ExcelJS.Workbook,
  name: string,
  columns: readonly ColumnName[],
  rows: SheetRow[],
) {
  const sheet = workbook.addWorksheet(name, {
    views: [{ state: "frozen", ySplit: 1 }],
  });

  sheet.columns = columns.map((column) => ({
    header: column,
    key: column,
    width: columnWidth(column),
  }));

  for (const row of rows) {
    sheet.addRow(row);
  }

  const header = sheet.getRow(1);
  header.font = { bold: true, color: { argb: "FF111827" } };
  header.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
  header.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFB91C" } };
  header.height = 24;
  sheet.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: 1, column: columns.length },
  };

  columns.forEach((column, index) => {
    const excelColumn = sheet.getColumn(index + 1);
    if (column === "Reported Date") excelColumn.numFmt = "dd-mm-yyyy";
    if (column === "Reported Time") excelColumn.numFmt = "hh:mm";
    if (numericColumns.has(column)) excelColumn.numFmt = "0.00";
    if (column === "Attachments Count") excelColumn.numFmt = "0";
    if (percentageColumns.has(column)) excelColumn.numFmt = "0.00%";
    excelColumn.alignment = { vertical: "top", wrapText: true };
  });

  applyBorders(sheet);
}

function applyBorders(sheet: ExcelJS.Worksheet) {
  sheet.eachRow((row) => {
    row.eachCell((cell) => {
      cell.border = {
        top: { style: "thin", color: { argb: "FFE5E7EB" } },
        left: { style: "thin", color: { argb: "FFE5E7EB" } },
        bottom: { style: "thin", color: { argb: "FFE5E7EB" } },
        right: { style: "thin", color: { argb: "FFE5E7EB" } },
      };
    });
  });
}

function columnWidth(column: string) {
  if (column.includes("Description") || column.includes("Action") || column.includes("Root Cause")) return 28;
  if (column.includes("Equipment Name") || column.includes("Category") || column.includes("Location")) return 24;
  if (column.includes("Date") || column.includes("Time") || column.includes("Status") || column.includes("Severity")) return 16;
  if (column.includes("Deviation") || column.includes("Attachment") || column.includes("Downtime")) return 18;
  return Math.min(Math.max(column.length + 4, 14), 30);
}

function sanitizeFilename(value: string) {
  return value.replace(/[^a-z0-9-_]+/gi, "_").replace(/_+/g, "_").replace(/^_|_$/g, "");
}
