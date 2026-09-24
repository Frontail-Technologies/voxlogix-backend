export const METER_COUNTER_DEVIATION_CONFIG_ERROR =
  "Expected Daily Consumption and Alert Deviation % must both be provided or both be blank.";
export const METER_COUNTER_EXPECTED_CONSUMPTION_ERROR =
  "Expected Daily Consumption must be greater than 0 when deviation monitoring is configured.";
export const METER_COUNTER_TOLERANCE_ERROR =
  "Alert Deviation % must be 0 or greater.";

function hasValue(value: unknown) {
  return value !== null && value !== undefined && !(typeof value === "string" && value.trim() === "");
}

export function getMeterCounterDeviationConfigError(
  expectedDailyConsumption: unknown,
  alertDeviationPct: unknown,
) {
  const hasExpectedConsumption = hasValue(expectedDailyConsumption);
  const hasDeviationTolerance = hasValue(alertDeviationPct);

  if (!hasExpectedConsumption && !hasDeviationTolerance) return null;
  if (hasExpectedConsumption !== hasDeviationTolerance) {
    return METER_COUNTER_DEVIATION_CONFIG_ERROR;
  }

  const expected = Number(expectedDailyConsumption);
  if (!Number.isFinite(expected) || expected <= 0) {
    return METER_COUNTER_EXPECTED_CONSUMPTION_ERROR;
  }

  const tolerance = Number(alertDeviationPct);
  if (!Number.isFinite(tolerance) || tolerance < 0) {
    return METER_COUNTER_TOLERANCE_ERROR;
  }

  return null;
}
