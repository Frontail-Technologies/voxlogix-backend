// Pure functions for master data import logic — no DB dependencies.
// Extracted here so they can be unit-tested independently.

// ---------------------------------------------------------------------------
// Seat delta calculation — used by importUsers to determine the net change in
// active (billable) seats BEFORE acquiring the seat lock.
//
// Rules:
//   - New row, targetActive=true  → +1 seat
//   - New row, targetActive=false → 0 seats
//   - Existing INACTIVE, targetActive=true  → +1 seat (reactivation)
//   - Existing ACTIVE,   targetActive=false → -1 seat (deactivation)
//   - Existing, same active/inactive state  → 0 seats
//   - Rows with blank employeeId are skipped (they fail required-field validation)
// ---------------------------------------------------------------------------

export type SeatRow = {
  employeeId: string;
  targetActive: boolean;
};

export type SeatDeltaResult = {
  netDelta: number;
  newActive: number;
  newInactive: number;
  activatedExisting: number;
  deactivatedExisting: number;
};

export function calculateSeatDelta(
  rows: ReadonlyArray<SeatRow>,
  existingByEmployeeId: ReadonlyMap<string, { status: string }>,
): SeatDeltaResult {
  let newActive = 0;
  let newInactive = 0;
  let activatedExisting = 0;
  let deactivatedExisting = 0;

  for (const row of rows) {
    if (!row.employeeId.trim()) continue;

    const existing = existingByEmployeeId.get(normalizedImportKey(row.employeeId));

    if (!existing) {
      if (row.targetActive) newActive++;
      else newInactive++;
    } else {
      const wasActive = existing.status === "ACTIVE";
      if (!wasActive && row.targetActive) activatedExisting++;
      else if (wasActive && !row.targetActive) deactivatedExisting++;
    }
  }

  return {
    netDelta: newActive + activatedExisting - deactivatedExisting,
    newActive,
    newInactive,
    activatedExisting,
    deactivatedExisting,
  };
}

/**
 * Normalizes a string for case-insensitive matching in import deduplication.
 * Trims whitespace and lowercases, matching the normalizedBusinessKey convention
 * used throughout the import service.
 */
export function normalizedImportKey(value: string): string {
  return value.trim().toLowerCase();
}

/**
 * Composite identity key for a Safety Reporting row.
 * Severity level is NOT part of the identity — it is an editable attribute.
 * Re-importing the same category + type with a changed severity must update
 * the existing row, not create a duplicate.
 */
export function normalizedSafetyKey(incidentCategory: string, incidentType: string): string {
  return `${normalizedImportKey(incidentCategory)}|${normalizedImportKey(incidentType)}`;
}

/**
 * Returns the 0-based row indexes (within a single upload) where the same
 * (incidentCategory, incidentType) pair appears more than once.
 * Rows missing either required field are excluded — they fail required-field
 * validation before duplicate detection runs.
 * All occurrences of a duplicate pair are returned, not just the later ones.
 */
export function findSafetyDuplicateIndexes(
  rows: ReadonlyArray<{ incidentCategory: string; incidentType: string }>,
): Set<number> {
  const indexesByKey = new Map<string, number[]>();

  rows.forEach(({ incidentCategory, incidentType }, index) => {
    if (!incidentCategory.trim() || !incidentType.trim()) return;
    const key = normalizedSafetyKey(incidentCategory, incidentType);
    indexesByKey.set(key, [...(indexesByKey.get(key) ?? []), index]);
  });

  const duplicateIndexes = new Set<number>();
  for (const indexes of indexesByKey.values()) {
    if (indexes.length > 1) indexes.forEach((i) => duplicateIndexes.add(i));
  }
  return duplicateIndexes;
}

/**
 * Returns the 0-based row indexes where the given entity business-ID column
 * appears more than once (case-insensitive, trimmed) within a single upload.
 * This mirrors the same duplicate-detection used for Equipment ID, Point ID,
 * Counter ID, and Employee ID.
 */
export function findEntityDuplicateIndexes(
  rows: ReadonlyArray<Record<string, string>>,
  normalizedHeaderKey: string,
): Set<number> {
  const indexesByKey = new Map<string, number[]>();

  rows.forEach((row, index) => {
    const raw = row[normalizedHeaderKey]?.trim();
    if (!raw) return;
    const key = normalizedImportKey(raw);
    indexesByKey.set(key, [...(indexesByKey.get(key) ?? []), index]);
  });

  const duplicateIndexes = new Set<number>();
  for (const indexes of indexesByKey.values()) {
    if (indexes.length > 1) indexes.forEach((i) => duplicateIndexes.add(i));
  }
  return duplicateIndexes;
}
