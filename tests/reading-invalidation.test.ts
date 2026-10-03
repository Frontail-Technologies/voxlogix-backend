import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  invalidateMeasuringPointReadingBodySchema,
} from "../src/modules/measuring-points/measuring-point.validation";
import {
  invalidateMeterCounterReadingBodySchema,
} from "../src/modules/meter-counters/meter-counter.validation";
import { evaluateCounterReading } from "../src/shared/domain/reading-calculations";

describe("reading invalidation validation", () => {
  it("requires a trimmed non-empty reason", () => {
    assert.equal(invalidateMeterCounterReadingBodySchema.safeParse({ reason: "   " }).success, false);
    assert.equal(invalidateMeasuringPointReadingBodySchema.safeParse({ reason: "" }).success, false);
  });

  it("accepts free-text reasons within the audit limit", () => {
    const result = invalidateMeterCounterReadingBodySchema.parse({ reason: " Wrong value entered " });

    assert.equal(result.reason, "Wrong value entered");
  });

  it("rejects unreasonably long reasons", () => {
    assert.equal(invalidateMeterCounterReadingBodySchema.safeParse({ reason: "x".repeat(501) }).success, false);
    assert.equal(invalidateMeasuringPointReadingBodySchema.safeParse({ reason: "x".repeat(501) }).success, false);
  });
});

describe("meter counter effective valid chain", () => {
  it("uses the latest valid previous reading after a middle reading is invalidated", () => {
    const result = evaluateCounterReading({
      currentReading: 6700,
      previousReading: 6500,
      previousReadingAt: new Date("2026-08-01T10:00:00.000Z"),
      currentReadingAt: new Date("2026-08-01T12:00:00.000Z"),
      resetValue: null,
      expectedDailyConsumption: 2400,
      alertDeviationPct: 10,
    });

    assert.equal(result.consumptionDelta, 200);
    assert.equal(result.expectedConsumptionForPeriod, 200);
    assert.equal(result.deviationPercent, 0);
    assert.equal(result.isAlert, false);
  });

  it("keeps approved positive-only deviation rules during recalculation", () => {
    const lower = evaluateCounterReading({
      currentReading: 6585,
      previousReading: 6500,
      previousReadingAt: new Date("2026-08-01T10:00:00.000Z"),
      currentReadingAt: new Date("2026-08-02T10:00:00.000Z"),
      resetValue: null,
      expectedDailyConsumption: 100,
      alertDeviationPct: 10,
    });
    const boundary = evaluateCounterReading({
      currentReading: 6610,
      previousReading: 6500,
      previousReadingAt: new Date("2026-08-01T10:00:00.000Z"),
      currentReadingAt: new Date("2026-08-02T10:00:00.000Z"),
      resetValue: null,
      expectedDailyConsumption: 100,
      alertDeviationPct: 10,
    });
    const high = evaluateCounterReading({
      currentReading: 6615,
      previousReading: 6500,
      previousReadingAt: new Date("2026-08-01T10:00:00.000Z"),
      currentReadingAt: new Date("2026-08-02T10:00:00.000Z"),
      resetValue: null,
      expectedDailyConsumption: 100,
      alertDeviationPct: 10,
    });

    assert.equal(lower.deviationPercent, -15);
    assert.equal(lower.isAlert, false);
    assert.equal(boundary.deviationPercent, 10);
    assert.equal(boundary.isAlert, false);
    assert.equal(high.deviationPercent, 15);
    assert.equal(high.isAlert, true);
  });
});
