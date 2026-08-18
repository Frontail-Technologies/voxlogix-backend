export type KpiMetric = {
  label: string;
  value: number | null;
  unit?: "count" | "hours" | "days" | "percent" | "currency";
};

export type KpiDashboardDto = {
  period: {
    fromDate: string;
    toDate: string;
  };
  company: {
    id: string;
    name: string;
  };
  generatedAt: string;
  summary: {
    totalEquipmentLogs: number;
    totalDowntimeHours: number;
    averageDowntimeHours: number | null;
    breakdownCount: number;
    plannedMaintenancePercent: number | null;
    safetyIncidents: number;
    criticalHighSafetyIncidents: number;
    outOfLimitMeasurements: number;
    highDeviationCounterReadings: number;
    kaizenSubmitted: number;
    kaizenClosureRate: number | null;
  };
  mttrByEquipmentCategory: Array<{
    equipmentCategory: string;
    averageDowntimeHours: number;
    breakdownCount: number;
  }>;
  downtimeBySection: Array<{
    section: string;
    totalDowntimeHours: number;
    percentageOfTotalDowntime: number | null;
  }>;
  repeatFailures: Array<{
    equipmentId: string;
    equipmentName: string;
    equipmentFunction: string;
    failureMode: string;
    occurrenceCount: number;
  }>;
  mtbfProxyByEquipment: Array<{
    equipmentId: string;
    equipmentName: string;
    averageDaysBetweenFailures: number | null;
    failureCount: number;
  }>;
  maintenanceTypeDistribution: {
    plannedMaintenancePercent: number | null;
    totalEquipmentLogs: number;
    items: Array<{
      maintenanceType: string;
      count: number;
      percentageOfTotal: number | null;
    }>;
  };
  productionImpactBreakdowns: {
    totalBreakdowns: number;
    items: Array<{
      productionImpact: string;
      count: number;
      percentageOfBreakdowns: number | null;
    }>;
  };
  safetyMonthlyTrend: Array<{
    month: string;
    incidentCount: number;
    criticalHighSeverityCount: number;
  }>;
  safetySeverityDistribution: Array<{
    severity: string;
    incidentCount: number;
    percentageOfTotal: number | null;
  }>;
  reportableSafety: {
    reportableCount: number;
    totalSafetyIncidents: number;
    knownReportabilityCount: number;
    unknownReportabilityCount: number;
    reportablePercent: number | null;
  };
  measuringPointOutOfLimit: {
    totalMeasurementReadings: number;
    totalOutOfLimitReadings: number;
    overallOutOfLimitPercent: number | null;
    items: Array<{
      measurementName: string;
      totalReadings: number;
      outOfLimitCount: number;
      outOfLimitPercent: number | null;
    }>;
  };
  meterCounterDeviation: {
    totalCounterReadings: number;
    highDeviationCount: number;
    items: Array<{
      counterId: string;
      counterName: string;
      averageDeviationPercent: number | null;
      highDeviationCount: number;
      readingCount: number;
    }>;
  };
  kaizenStatusFunnel: {
    totalKaizen: number;
    closureRate: number | null;
    items: Array<{
      status: string;
      count: number;
    }>;
  };
  kaizenByCategory: Array<{
    category: string;
    count: number;
    percentageOfTotal: number | null;
  }>;
};
