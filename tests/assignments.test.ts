import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildAssignmentNotification, hasMeaningfulAssignmentChange } from "../src/modules/assignments/assignment.domain";
import { createAssignmentBodySchema, updateAssignmentBodySchema } from "../src/modules/assignments/assignment.validation";
import { NOTIFICATION_TYPES } from "../src/modules/notifications/notification.domain";

const executorA = "00000000-0000-4000-8000-000000000001";
const executorB = "00000000-0000-4000-8000-000000000002";
const scheduledAt = new Date("2026-09-25T09:30:00.000Z");

describe("scheduled assignment changes", () => {
  it("does not treat an unchanged save as meaningful", () => {
    const assignment = { assignedToUserId: executorA, title: "Inspect pump", description: "Check pressure", scheduledAt };
    assert.equal(hasMeaningfulAssignmentChange(assignment, { ...assignment }), false);
  });

  it("treats executor, schedule, title, and instruction changes as meaningful", () => {
    const current = { assignedToUserId: executorA, title: "Inspect pump", description: null, scheduledAt };
    assert.equal(hasMeaningfulAssignmentChange(current, { ...current, assignedToUserId: executorB }), true);
    assert.equal(hasMeaningfulAssignmentChange(current, { ...current, scheduledAt: new Date("2026-09-25T10:30:00.000Z") }), true);
    assert.equal(hasMeaningfulAssignmentChange(current, { ...current, title: "Inspect motor" }), true);
    assert.equal(hasMeaningfulAssignmentChange(current, { ...current, description: "Check vibration" }), true);
  });
});

describe("assignment notifications", () => {
  it("builds assigned, updated, and cancelled messages with schedule details", () => {
    const details = { title: "Inspect pump", description: "Check pressure", scheduledAt };
    const assigned = buildAssignmentNotification("ASSIGNED", details);
    const updated = buildAssignmentNotification("UPDATED", details);
    const cancelled = buildAssignmentNotification("CANCELLED", details);

    assert.equal(assigned.type, NOTIFICATION_TYPES.SCHEDULE_ASSIGNED);
    assert.equal(assigned.title, "New work scheduled");
    assert.match(assigned.message, /Inspect pump/);
    assert.match(assigned.message, /Sep 25, 2026/);
    assert.match(assigned.message, /Check pressure/);
    assert.equal(updated.type, NOTIFICATION_TYPES.SCHEDULE_UPDATED);
    assert.equal(cancelled.type, NOTIFICATION_TYPES.SCHEDULE_CANCELLED);
  });
});

describe("assignment validation", () => {
  it("accepts a valid Executor assignment and parses the scheduled time", () => {
    const parsed = createAssignmentBodySchema.parse({ assignedToUserId: executorA, title: "Inspect pump", scheduledAt: scheduledAt.toISOString() });
    assert.equal(parsed.assignedToUserId, executorA);
    assert.equal(parsed.scheduledAt.getTime(), scheduledAt.getTime());
  });

  it("rejects missing assignment fields and empty updates", () => {
    assert.equal(createAssignmentBodySchema.safeParse({ title: "Inspect pump" }).success, false);
    assert.equal(updateAssignmentBodySchema.safeParse({}).success, false);
  });
});
