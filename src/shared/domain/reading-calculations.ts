export type MeasurementStatus = "NORMAL" | "OUT_OF_LIMIT";
export type CounterReadingStatus = "NORMAL" | "HIGH_DEVIATION";

export type MeasurementEvaluation = {
  measurementStatus: MeasurementStatus;
  isAlert: boolean;
  deviationFromTarget: number | null;
  deviationPercent: number | null;
};

export type CounterEvaluationInput = {
  currentReading: number;
  previousReading: number | null;
  previousReadingAt: Date | null;
  currentReadingAt: Date;
  resetValue: number | null;
  expectedDailyConsumption: number | null;
  alertDeviationPct: number | null;
};

export type CounterEvaluation = {
  counterStatus: CounterReadingStatus;
  isAlert: boolean;
  consumptionDelta: number | null;
  expectedConsumptionForPeriod: number | null;
  deviation: number | null;
  deviationPercent: number | null;
};

export function parseFiniteNumber(value: unknown, field = "value") {
  const parsed = typeof value === "number" ? value : Number(value);

  if (!Number.isFinite(parsed)) {
    throw new Error(`${field} must be a valid number.`);
  }

  return parsed;
}

export function nullableNumber(value: string | number | null | undefined) {
  if (value === null || value === undefined || value === "") return null;
  return parseFiniteNumber(value);
}

export function dbNumber(value: number | null | undefined) {
  if (value === null || value === undefined) return null;
  return value.toFixed(4);
}

export function evaluateMeasurement(input: {
  measuredValue: number;
  targetValue: number | null;
  lowerLimit: number | null;
  upperLimit: number | null;
}): MeasurementEvaluation {
  const isBelow = input.lowerLimit !== null && input.measuredValue < input.lowerLimit;
  const isAbove = input.upperLimit !== null && input.measuredValue > input.upperLimit;
  const deviationFromTarget = input.targetValue === null ? null : input.measuredValue - input.targetValue;
  const deviationPercent =
    input.targetValue === null || input.targetValue === 0 || deviationFromTarget === null
      ? null
      : (deviationFromTarget / input.targetValue) * 100;
  const measurementStatus: MeasurementStatus = isBelow || isAbove ? "OUT_OF_LIMIT" : "NORMAL";

  return {
    measurementStatus,
    isAlert: measurementStatus === "OUT_OF_LIMIT",
    deviationFromTarget,
    deviationPercent,
  };
}

export function evaluateCounterReading(input: CounterEvaluationInput): CounterEvaluation {
  if (input.previousReading === null || input.previousReadingAt === null) {
    return {
      counterStatus: "NORMAL",
      isAlert: false,
      consumptionDelta: null,
      expectedConsumptionForPeriod: null,
      deviation: null,
      deviationPercent: null,
    };
  }

  let consumptionDelta: number;

  if (input.currentReading >= input.previousReading) {
    consumptionDelta = input.currentReading - input.previousReading;
  } else {
    if (input.resetValue === null || input.resetValue <= input.previousReading) {
      throw new Error("Current reading is lower than previous reading and no valid reset value is configured.");
    }

    consumptionDelta = input.resetValue - input.previousReading + input.currentReading;
  }

  const elapsedDays = Math.max(
    0,
    (input.currentReadingAt.getTime() - input.previousReadingAt.getTime()) / 86_400_000,
  );
  const expectedConsumptionForPeriod =
    input.expectedDailyConsumption === null ? null : input.expectedDailyConsumption * elapsedDays;
  const deviation =
    expectedConsumptionForPeriod === null ? null : consumptionDelta - expectedConsumptionForPeriod;
  const deviationPercent =
    expectedConsumptionForPeriod === null || expectedConsumptionForPeriod === 0 || deviation === null
      ? null
      : (deviation / expectedConsumptionForPeriod) * 100;
  const isAlert =
    deviationPercent !== null &&
    input.alertDeviationPct !== null &&
    Math.abs(deviationPercent) > input.alertDeviationPct;

  return {
    counterStatus: isAlert ? "HIGH_DEVIATION" : "NORMAL",
    isAlert,
    consumptionDelta,
    expectedConsumptionForPeriod,
    deviation,
    deviationPercent,
  };
}
