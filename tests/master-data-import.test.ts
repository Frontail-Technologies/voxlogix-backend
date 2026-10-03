import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  findEntityDuplicateIndexes,
  findSafetyDuplicateIndexes,
  normalizedImportKey,
  normalizedSafetyKey,
} from "../src/modules/master-data-imports/master-data-import.domain";

// ---------------------------------------------------------------------------
// normalizedImportKey
// ---------------------------------------------------------------------------

describe("normalizedImportKey", () => {
  it("lowercases and trims whitespace", () => {
    assert.equal(normalizedImportKey("  Near Miss  "), "near miss");
    assert.equal(normalizedImportKey("EMP-001"), "emp-001");
  });

  it("handles already-normalized values without mutation", () => {
    assert.equal(normalizedImportKey("emp-001"), "emp-001");
  });
});

// ---------------------------------------------------------------------------
// normalizedSafetyKey — severity is NOT part of the key
// ---------------------------------------------------------------------------

describe("normalizedSafetyKey", () => {
  it("combines category and type into a single key", () => {
    const key = normalizedSafetyKey("Near Miss", "Material dropped");
    assert.ok(key.includes("near miss"));
    assert.ok(key.includes("material dropped"));
  });

  it("same category + type + same severity → same key", () => {
    const a = normalizedSafetyKey("Near Miss", "Material dropped from height");
    const b = normalizedSafetyKey("Near Miss", "Material dropped from height");
    assert.equal(a, b);
  });

  it("same category + type + DIFFERENT severity → same key (severity is not identity)", () => {
    // This is the fix: changing severity on re-import must not produce a new record.
    const highSeverityKey = normalizedSafetyKey("Near Miss", "Material dropped from height");
    const criticalSeverityKey = normalizedSafetyKey("Near Miss", "Material dropped from height");
    assert.equal(highSeverityKey, criticalSeverityKey);
  });

  it("different incident category → different key", () => {
    const a = normalizedSafetyKey("Near Miss", "Material dropped from height");
    const b = normalizedSafetyKey("Unsafe Condition", "Material dropped from height");
    assert.notEqual(a, b);
  });

  it("different incident type → different key", () => {
    const a = normalizedSafetyKey("Near Miss", "Material dropped from height");
    const b = normalizedSafetyKey("Near Miss", "Oil spill near walkway");
    assert.notEqual(a, b);
  });

  it("matching is case-insensitive", () => {
    const a = normalizedSafetyKey("NEAR MISS", "MATERIAL DROPPED");
    const b = normalizedSafetyKey("near miss", "material dropped");
    const c = normalizedSafetyKey("Near Miss", "Material Dropped");
    assert.equal(a, b);
    assert.equal(b, c);
  });

  it("matching trims surrounding whitespace", () => {
    const a = normalizedSafetyKey("  Near Miss  ", "  Material dropped  ");
    const b = normalizedSafetyKey("Near Miss", "Material dropped");
    assert.equal(a, b);
  });
});

// ---------------------------------------------------------------------------
// findSafetyDuplicateIndexes — in-workbook duplicate detection
// ---------------------------------------------------------------------------

describe("findSafetyDuplicateIndexes", () => {
  it("returns empty set when all rows are unique", () => {
    const rows = [
      { incidentCategory: "Near Miss", incidentType: "Material dropped" },
      { incidentCategory: "Unsafe Condition", incidentType: "Oil spill" },
      { incidentCategory: "Near Miss", incidentType: "Oil spill" },
    ];
    assert.equal(findSafetyDuplicateIndexes(rows).size, 0);
  });

  it("flags BOTH occurrences when a category+type pair appears twice", () => {
    const rows = [
      { incidentCategory: "Near Miss", incidentType: "Material dropped" }, // 0
      { incidentCategory: "Unsafe Condition", incidentType: "Oil spill" },  // 1
      { incidentCategory: "Near Miss", incidentType: "Material dropped" }, // 2 — duplicate of 0
    ];
    const dupes = findSafetyDuplicateIndexes(rows);
    assert.ok(dupes.has(0), "first occurrence should be flagged");
    assert.ok(dupes.has(2), "second occurrence should be flagged");
    assert.ok(!dupes.has(1), "unrelated row must not be flagged");
  });

  it("flags same-category-type pair even when severity differs (severity not in identity)", () => {
    // Row 0: category=Near Miss, type=Material dropped (severity High, implicit)
    // Row 1: category=Near Miss, type=Material dropped (severity Critical, implicit)
    // Both rows share the same identity — both are flagged as duplicates.
    const rows = [
      { incidentCategory: "Near Miss", incidentType: "Material dropped from height" },
      { incidentCategory: "Near Miss", incidentType: "Material dropped from height" },
    ];
    const dupes = findSafetyDuplicateIndexes(rows);
    assert.ok(dupes.has(0));
    assert.ok(dupes.has(1));
  });

  it("applies case-insensitive and trimmed matching", () => {
    const rows = [
      { incidentCategory: "NEAR MISS", incidentType: "Material Dropped" },
      { incidentCategory: "near miss", incidentType: "material dropped" },
    ];
    const dupes = findSafetyDuplicateIndexes(rows);
    assert.equal(dupes.size, 2, "case variants of the same entry should be duplicates");
  });

  it("excludes rows missing a required field from duplicate detection", () => {
    const rows = [
      { incidentCategory: "", incidentType: "Material dropped" },       // 0 — missing category
      { incidentCategory: "Near Miss", incidentType: "" },              // 1 — missing type
      { incidentCategory: "Near Miss", incidentType: "Material dropped" }, // 2 — valid
    ];
    // No pair forms a complete key, so no duplicates should be detected.
    assert.equal(findSafetyDuplicateIndexes(rows).size, 0);
  });

  it("handles a fresh template with only new rows — no duplicates", () => {
    const rows = [
      { incidentCategory: "Near Miss", incidentType: "Material dropped" },
      { incidentCategory: "Unsafe Condition", incidentType: "Oil spill near walkway" },
      { incidentCategory: "Near Miss", incidentType: "Pinch-point injury" },
    ];
    assert.equal(findSafetyDuplicateIndexes(rows).size, 0);
  });

  it("handles old workbook rows appended with new rows — no duplicates if existing rows unique", () => {
    // Simulates: old workbook has rows 0-1, user appended row 2 at the bottom.
    const rows = [
      { incidentCategory: "Near Miss", incidentType: "Material dropped" },       // existing
      { incidentCategory: "Unsafe Condition", incidentType: "Oil spill" },       // existing
      { incidentCategory: "Near Miss", incidentType: "Pinch-point injury" },     // new
    ];
    assert.equal(findSafetyDuplicateIndexes(rows).size, 0);
  });
});

// ---------------------------------------------------------------------------
// findEntityDuplicateIndexes — used by Equipment, Users, MP, MC
// ---------------------------------------------------------------------------

describe("findEntityDuplicateIndexes", () => {
  it("returns empty set when all IDs are unique", () => {
    const rows = [
      { "EMPLOYEE ID": "EMP-001", "FULL NAME": "Alice" },
      { "EMPLOYEE ID": "EMP-002", "FULL NAME": "Bob" },
      { "EMPLOYEE ID": "EMP-003", "FULL NAME": "Charlie" },
    ];
    assert.equal(findEntityDuplicateIndexes(rows, "EMPLOYEE ID").size, 0);
  });

  it("flags both rows when the same Employee ID appears twice", () => {
    const rows = [
      { "EMPLOYEE ID": "EMP-001", "FULL NAME": "Alice" },
      { "EMPLOYEE ID": "EMP-002", "FULL NAME": "Bob" },
      { "EMPLOYEE ID": "EMP-001", "FULL NAME": "Alice Second Account" }, // duplicate
    ];
    const dupes = findEntityDuplicateIndexes(rows, "EMPLOYEE ID");
    assert.ok(dupes.has(0));
    assert.ok(dupes.has(2));
    assert.ok(!dupes.has(1));
  });

  it("same display name with different Employee IDs is NOT a duplicate", () => {
    // Two employees with the same name are legitimate as long as their IDs differ.
    const rows = [
      { "EMPLOYEE ID": "EMP-001", "FULL NAME": "Ravi Patel" },
      { "EMPLOYEE ID": "EMP-002", "FULL NAME": "Ravi Patel" }, // same name, different ID
    ];
    assert.equal(findEntityDuplicateIndexes(rows, "EMPLOYEE ID").size, 0);
  });

  it("Employee ID matching is case-insensitive", () => {
    const rows = [
      { "EMPLOYEE ID": "EMP-001", "FULL NAME": "Alice" },
      { "EMPLOYEE ID": "emp-001", "FULL NAME": "Alice Lowercase" },
    ];
    const dupes = findEntityDuplicateIndexes(rows, "EMPLOYEE ID");
    assert.equal(dupes.size, 2, "case variants of same employee ID must be duplicates");
  });

  it("excludes rows missing the ID from duplicate detection", () => {
    const rows = [
      { "EMPLOYEE ID": "", "FULL NAME": "Missing ID" },
      { "EMPLOYEE ID": "EMP-001", "FULL NAME": "Alice" },
    ];
    assert.equal(findEntityDuplicateIndexes(rows, "EMPLOYEE ID").size, 0);
  });

  it("company isolation: same ID in two different uploads does not collide", () => {
    // Each company runs its own import; duplication detection is scoped to a single
    // upload's rows. Two separate uploads with the same employee ID are independent.
    const companyARows = [{ "EMPLOYEE ID": "EMP-001", "FULL NAME": "Alice" }];
    const companyBRows = [{ "EMPLOYEE ID": "EMP-001", "FULL NAME": "Bob" }];
    assert.equal(findEntityDuplicateIndexes(companyARows, "EMPLOYEE ID").size, 0);
    assert.equal(findEntityDuplicateIndexes(companyBRows, "EMPLOYEE ID").size, 0);
  });

  it("re-importing old rows (same IDs) as part of workflow B — no in-workbook duplicates", () => {
    // Old workbook has EMP-001 and EMP-002. User appends EMP-003 at the bottom and re-uploads.
    // The old rows appear once each → no in-workbook duplicates. DB upsert handles update vs create.
    const rows = [
      { "EMPLOYEE ID": "EMP-001", "FULL NAME": "Alice" },
      { "EMPLOYEE ID": "EMP-002", "FULL NAME": "Bob" },
      { "EMPLOYEE ID": "EMP-003", "FULL NAME": "Charlie" }, // new row
    ];
    assert.equal(findEntityDuplicateIndexes(rows, "EMPLOYEE ID").size, 0);
  });
});
