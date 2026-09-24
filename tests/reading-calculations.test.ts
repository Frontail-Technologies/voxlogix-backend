import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { meterCounterBodySchema } from "../src/modules/imported-master-data/imported-master-data.validation";
import {
  METER_COUNTER_DEVIATION_CONFIG_ERROR,
  METER_COUNTER_EXPECTED_CONSUMPTION_ERROR,
  METER_COUNTER_TOLERANCE_ERROR,
} from "../src/shared/domain/meter-counter-configuration";
import { evaluateCounterReading } from "../src/shared/domain/reading-calculations";

const previousReadingAt = new Date("2026-08-01T00:00:00.000Z");
const currentReadingAt = new Date("2026-08-02T00:00:00.000Z");

function evaluate(currentReading: number, overrides: Partial<Parameters<typeof evaluateCounterReading>[0]> = {}) {
  return evaluateCounterReading({
    currentReading,
    previousReading: 0,
    previousReadingAt,
    currentReadingAt,
    resetValue: null,
    expectedDailyConsumption: 100,
    alertDeviationPct: 10,
    ...overrides,
  });
}

describe("evaluateCounterReading", () => {
  it("alerts when positive over-consumption exceeds tolerance", () => {
    const result = evaluate(115);

    assert.equal(result.deviationPercent, 15);
    assert.equal(result.counterStatus, "HIGH_DEVIATION");
    assert.equal(result.isAlert, true);
  });

  it("keeps positive consumption within tolerance normal", () => {
    const result = evaluate(105);

    assert.equal(result.deviationPercent, 5);
    assert.equal(result.counterStatus, "NORMAL");
    assert.equal(result.isAlert, false);
  });

  it("keeps the exact positive tolerance boundary normal", () => {
    const result = evaluate(110);

    assert.equal(result.deviationPercent, 10);
    assert.equal(result.counterStatus, "NORMAL");
    assert.equal(result.isAlert, false);
  });

  it("does not alert for lower consumption", () => {
    const result = evaluate(85);

    assert.equal(result.deviationPercent, -15);
    assert.equal(result.counterStatus, "NORMAL");
    assert.equal(result.isAlert, false);
  });

  it("treats missing expected consumption and tolerance as tracking-only", () => {
    const result = evaluate(15, {
      expectedDailyConsumption: null,
      alertDeviationPct: null,
    });

    assert.equal(result.consumptionDelta, 15);
    assert.equal(result.expectedConsumptionForPeriod, null);
    assert.equal(result.deviation, null);
    assert.equal(result.deviationPercent, null);
    assert.equal(result.counterStatus, "NORMAL");
    assert.equal(result.isAlert, false);
  });

  it("rejects incomplete deviation configuration", () => {
    assert.throws(
      () => evaluate(115, { alertDeviationPct: null }),
      new RegExp(METER_COUNTER_DEVIATION_CONFIG_ERROR.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")),
    );
    assert.throws(
      () => evaluate(115, { expectedDailyConsumption: null }),
      new RegExp(METER_COUNTER_DEVIATION_CONFIG_ERROR.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")),
    );
  });

  it("rejects zero or negative expected consumption", () => {
    for (const expectedDailyConsumption of [0, -1]) {
      assert.throws(
        () => evaluate(115, { expectedDailyConsumption }),
        new RegExp(METER_COUNTER_EXPECTED_CONSUMPTION_ERROR.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")),
      );
    }
  });

  it("allows zero tolerance and alerts on any positive over-consumption", () => {
    const atExpected = evaluate(100, { alertDeviationPct: 0 });
    const aboveExpected = evaluate(101, { alertDeviationPct: 0 });

    assert.equal(atExpected.isAlert, false);
    assert.equal(aboveExpected.deviationPercent, 1);
    assert.equal(aboveExpected.isAlert, true);
  });

  it("rejects negative tolerance", () => {
    assert.throws(
      () => evaluate(100, { alertDeviationPct: -1 }),
      new RegExp(METER_COUNTER_TOLERANCE_ERROR.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")),
    );
  });

  it("calculates a running-hours delta without deviation configuration", () => {
    const result = evaluate(128, {
      previousReading: 120,
      expectedDailyConsumption: null,
      alertDeviationPct: null,
    });

    assert.equal(result.consumptionDelta, 8);
    assert.equal(result.deviationPercent, null);
    assert.equal(result.isAlert, false);
  });

  it("prorates the 24-hour expectation using exact elapsed time", () => {
    const result = evaluate(60, {
      currentReadingAt: new Date("2026-08-01T12:00:00.000Z"),
    });

    assert.equal(result.expectedConsumptionForPeriod, 50);
    assert.equal(result.deviationPercent, 20);
    assert.equal(result.isAlert, true);
  });

  it("preserves reset handling", () => {
    const result = evaluate(10, {
      previousReading: 95,
      resetValue: 100,
      expectedDailyConsumption: null,
      alertDeviationPct: null,
    });

    assert.equal(result.consumptionDelta, 15);
    assert.equal(result.isAlert, false);
  });
});

describe("meterCounterBodySchema", () => {
  it("accepts blank expected consumption and tolerance as null", () => {
    const result = meterCounterBodySchema.parse({
      expectedDailyConsumption: "",
      alertDeviationPct: "   ",
    });

    assert.equal(result.expectedDailyConsumption, null);
    assert.equal(result.alertDeviationPct, null);
  });

  it("preserves explicit zero values instead of confusing them with blanks", () => {
    const result = meterCounterBodySchema.parse({
      expectedDailyConsumption: "0",
      alertDeviationPct: 0,
    });

    assert.equal(result.expectedDailyConsumption, 0);
    assert.equal(result.alertDeviationPct, 0);
  });
});
