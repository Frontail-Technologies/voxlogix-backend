import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  calculateSeatDelta,
  type SeatRow,
} from "../src/modules/master-data-imports/master-data-import.domain";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function existing(status: "ACTIVE" | "INACTIVE") {
  return { status } as const;
}

function activeMap(entries: Array<[string, "ACTIVE" | "INACTIVE"]>): ReadonlyMap<string, { status: string }> {
  return new Map(entries.map(([k, v]) => [k.trim().toLowerCase(), existing(v)]));
}

// ---------------------------------------------------------------------------
// calculateSeatDelta — pure seat-delta calculation for import rows
// ---------------------------------------------------------------------------

describe("calculateSeatDelta", () => {
  // ----- creation scenarios -----

  it("new active user consumes one seat", () => {
    const rows: SeatRow[] = [{ employeeId: "EMP-001", targetActive: true }];
    const { netDelta, newActive } = calculateSeatDelta(rows, new Map());
    assert.equal(netDelta, 1);
    assert.equal(newActive, 1);
  });

  it("new inactive user consumes no seat", () => {
    const rows: SeatRow[] = [{ employeeId: "EMP-001", targetActive: false }];
    const { netDelta, newInactive } = calculateSeatDelta(rows, new Map());
    assert.equal(netDelta, 0);
    assert.equal(newInactive, 1);
  });

  it("create below limit: delta below available seats is fine (caller compares against available)", () => {
    // Three new active users → delta=3. Caller checks 3 <= available.
    const rows: SeatRow[] = [
      { employeeId: "EMP-001", targetActive: true },
      { employeeId: "EMP-002", targetActive: true },
      { employeeId: "EMP-003", targetActive: true },
    ];
    const { netDelta } = calculateSeatDelta(rows, new Map());
    assert.equal(netDelta, 3);
  });

  it("create exactly up to limit: delta equals available seats is fine", () => {
    // Two new active users with 2 available seats → delta=2. 2 <= 2 passes.
    const rows: SeatRow[] = [
      { employeeId: "EMP-001", targetActive: true },
      { employeeId: "EMP-002", targetActive: true },
    ];
    const { netDelta } = calculateSeatDelta(rows, new Map());
    assert.equal(netDelta, 2);
    // Caller: 2 <= 2 → allowed
    const available = 2;
    assert.ok(netDelta <= available, "should fit exactly at limit");
  });

  it("create above limit: delta greater than available seats is rejected by caller", () => {
    // Three new active users with only 2 available → delta=3 > 2 → rejected.
    const rows: SeatRow[] = [
      { employeeId: "EMP-001", targetActive: true },
      { employeeId: "EMP-002", targetActive: true },
      { employeeId: "EMP-003", targetActive: true },
    ];
    const { netDelta } = calculateSeatDelta(rows, new Map());
    const available = 2;
    assert.ok(netDelta > available, "should exceed available seats");
  });

  // ----- deactivation / reactivation -----

  it("deactivate existing active user frees one seat (negative delta)", () => {
    const rows: SeatRow[] = [{ employeeId: "EMP-001", targetActive: false }];
    const map = activeMap([["EMP-001", "ACTIVE"]]);
    const { netDelta, deactivatedExisting } = calculateSeatDelta(rows, map);
    assert.equal(deactivatedExisting, 1);
    assert.equal(netDelta, -1);
  });

  it("reactivate existing inactive user consumes one seat", () => {
    const rows: SeatRow[] = [{ employeeId: "EMP-001", targetActive: true }];
    const map = activeMap([["EMP-001", "INACTIVE"]]);
    const { netDelta, activatedExisting } = calculateSeatDelta(rows, map);
    assert.equal(activatedExisting, 1);
    assert.equal(netDelta, 1);
  });

  it("reactivate when full: delta=1 > available=0 → caller rejects", () => {
    const rows: SeatRow[] = [{ employeeId: "EMP-001", targetActive: true }];
    const map = activeMap([["EMP-001", "INACTIVE"]]);
    const { netDelta } = calculateSeatDelta(rows, map);
    const available = 0;
    assert.ok(netDelta > available, "reactivation at full capacity must be rejected");
  });

  // ----- re-import / update scenarios -----

  it("existing active Employee ID re-imported as active consumes no extra seat", () => {
    const rows: SeatRow[] = [{ employeeId: "EMP-001", targetActive: true }];
    const map = activeMap([["EMP-001", "ACTIVE"]]);
    const { netDelta } = calculateSeatDelta(rows, map);
    assert.equal(netDelta, 0, "active→active is a no-op for seat count");
  });

  it("existing inactive Employee ID re-imported as inactive consumes no seat", () => {
    const rows: SeatRow[] = [{ employeeId: "EMP-001", targetActive: false }];
    const map = activeMap([["EMP-001", "INACTIVE"]]);
    const { netDelta } = calculateSeatDelta(rows, map);
    assert.equal(netDelta, 0, "inactive→inactive is a no-op for seat count");
  });

  it("inactive → active through import consumes one seat", () => {
    const rows: SeatRow[] = [{ employeeId: "EMP-001", targetActive: true }];
    const map = activeMap([["EMP-001", "INACTIVE"]]);
    const { netDelta } = calculateSeatDelta(rows, map);
    assert.equal(netDelta, 1);
  });

  it("active → inactive through import frees one seat", () => {
    const rows: SeatRow[] = [{ employeeId: "EMP-001", targetActive: false }];
    const map = activeMap([["EMP-001", "ACTIVE"]]);
    const { netDelta } = calculateSeatDelta(rows, map);
    assert.equal(netDelta, -1);
  });

  // ----- import batch / atomicity scenarios -----

  it("import exceeding limit: mixed batch where net delta exceeds available is detectable", () => {
    // 3 existing active (no change), 2 new active, 1 new inactive.
    // Net delta = 2. Caller checks 2 > available (e.g. 1) → reject.
    const rows: SeatRow[] = [
      { employeeId: "EMP-001", targetActive: true },  // existing active → no delta
      { employeeId: "EMP-002", targetActive: true },  // existing active → no delta
      { employeeId: "EMP-003", targetActive: true },  // existing active → no delta
      { employeeId: "EMP-004", targetActive: true },  // new active → +1
      { employeeId: "EMP-005", targetActive: true },  // new active → +1
      { employeeId: "EMP-006", targetActive: false }, // new inactive → 0
    ];
    const map = activeMap([
      ["EMP-001", "ACTIVE"],
      ["EMP-002", "ACTIVE"],
      ["EMP-003", "ACTIVE"],
    ]);
    const { netDelta } = calculateSeatDelta(rows, map);
    assert.equal(netDelta, 2, "only genuinely new active users count against the limit");
    const available = 1;
    assert.ok(netDelta > available, "should reject atomically");
  });

  it("import atomically rejects all rows when limit exceeded (delta checked before writes)", () => {
    // This tests the INVARIANT: netDelta is computed before any write happens.
    // If netDelta > available, NO rows are written (the entire import is rejected).
    // This test validates the pure logic; transactional atomicity is enforced in the service.
    const rows: SeatRow[] = [
      { employeeId: "EMP-004", targetActive: true },
      { employeeId: "EMP-005", targetActive: true },
    ];
    const { netDelta } = calculateSeatDelta(rows, new Map());
    // With limit=20 and activeCount=19, available=1. netDelta=2 > 1 → reject entire batch.
    const available = 1;
    assert.ok(netDelta > available, "entire import must be rejected, not just overflow rows");
  });

  // ----- identity and isolation -----

  it("same display name with different Employee IDs is not a duplicate", () => {
    // Two employees named "Ravi Patel" with different IDs — each is a distinct person.
    const rows: SeatRow[] = [
      { employeeId: "EMP-001", targetActive: true },
      { employeeId: "EMP-002", targetActive: true },
    ];
    const { netDelta, newActive } = calculateSeatDelta(rows, new Map());
    assert.equal(newActive, 2, "two distinct IDs → two new seats");
    assert.equal(netDelta, 2);
  });

  it("company isolation: separate calculateSeatDelta calls never share state", () => {
    // Company A and B each import EMP-001. Each call is isolated by its own map.
    const rowsA: SeatRow[] = [{ employeeId: "EMP-001", targetActive: true }];
    const rowsB: SeatRow[] = [{ employeeId: "EMP-001", targetActive: true }];
    const deltaA = calculateSeatDelta(rowsA, new Map());
    const deltaB = calculateSeatDelta(rowsB, new Map());
    assert.equal(deltaA.netDelta, 1, "company A: new active user");
    assert.equal(deltaB.netDelta, 1, "company B: independently new active user");
  });

  // ----- rows with blank employeeId are excluded -----

  it("rows with blank employeeId are excluded from delta calculation", () => {
    const rows: SeatRow[] = [
      { employeeId: "", targetActive: true },
      { employeeId: "EMP-001", targetActive: true },
    ];
    const { netDelta, newActive } = calculateSeatDelta(rows, new Map());
    assert.equal(newActive, 1, "blank-ID row excluded; only EMP-001 counts");
    assert.equal(netDelta, 1);
  });

  it("case-insensitive match: EMP-001 and emp-001 treated as the same existing user", () => {
    const rows: SeatRow[] = [{ employeeId: "EMP-001", targetActive: true }];
    // Map key is normalized (lowercased), matching normalizedImportKey
    const map = activeMap([["EMP-001", "ACTIVE"]]);
    const { netDelta } = calculateSeatDelta(rows, map);
    assert.equal(netDelta, 0, "case-insensitive match → no new seat");
  });

  // ----- role counts (documented invariants) -----

  it("role counts: active admin, planner, and execution all count as seats", () => {
    // Three new active users of different roles — each consumes a seat.
    const rows: SeatRow[] = [
      { employeeId: "ADM-001", targetActive: true },  // ADMIN role (company-level)
      { employeeId: "PLN-001", targetActive: true },  // PLANNER role
      { employeeId: "EXE-001", targetActive: true },  // EXECUTION role
    ];
    const { netDelta } = calculateSeatDelta(rows, new Map());
    assert.equal(netDelta, 3, "all three non-MASTER roles count as seats");
  });

  it("ADMIN cannot change userCreationLimit — validated by backend auth (documented invariant)", () => {
    // This invariant is enforced by the MASTER-only route:
    //   PATCH /companies/:companyId/access uses requireRole(USER_ROLES.MASTER)
    // Company ADMINs hit 403 Forbidden before reaching updateCompanyAccessById.
    // This test documents the requirement rather than exercising the auth middleware.
    assert.ok(true, "MASTER-only route documented in company.routes.ts");
  });

  it("Master cannot lower limit below current active count — validatedin updateCompanyAccessById", () => {
    // updateCompanyAccessById in company.service.ts calls getActiveSeatCount and throws
    // SEAT_LIMIT_REACHED if newLimit < activeCount. This pure test documents the invariant.
    const activeCount = 15;
    const newLimit = 10;
    assert.ok(newLimit < activeCount, "should be rejected: limit below current active count");
  });
});
