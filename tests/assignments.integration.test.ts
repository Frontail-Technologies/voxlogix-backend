import assert from "node:assert/strict";
import { after, describe, it } from "node:test";
import { eq, inArray } from "drizzle-orm";

import { db, postgresClient } from "../src/db";
import { admins, companies, inAppNotifications, scheduledAssignments } from "../src/db/schema";
import { cancelAssignment, createAssignment, updateAssignment } from "../src/modules/assignments/assignment.service";
import { getUnreadNotificationCount, listNotifications, markAllNotificationsRead, markNotificationRead } from "../src/modules/notifications/notification.service";

const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
const companyIds: string[] = [];
const userIds: string[] = [];

after(async () => {
  if (companyIds.length) {
    await db.delete(inAppNotifications).where(inArray(inAppNotifications.companyId, companyIds));
    await db.delete(scheduledAssignments).where(inArray(scheduledAssignments.companyId, companyIds));
  }
  if (userIds.length) await db.delete(admins).where(inArray(admins.id, userIds));
  if (companyIds.length) await db.delete(companies).where(inArray(companies.id, companyIds));
  await postgresClient.end();
});

async function makeCompany(name: string) {
  const [company] = await db.insert(companies).values({
    name,
    slug: `${name.toLowerCase().replace(/\s+/g, "-")}-${suffix}`,
    ownerName: "Test Owner",
    ownerEmail: `${name.toLowerCase().replace(/\s+/g, ".")}@${suffix}.test`,
    ownerPhone: "0000000000",
    businessType: "Testing",
    plan: "TEST",
  }).returning({ id: companies.id });
  companyIds.push(company.id);
  return company.id;
}

async function makeUser(companyId: string, name: string, role: "ADMIN" | "PLANNER" | "EXECUTION") {
  const key = `${name.toLowerCase().replace(/\s+/g, "-")}-${suffix}`;
  const [user] = await db.insert(admins).values({
    companyId,
    fullName: name,
    initials: name.split(/\s+/).map((part) => part[0]).join("").slice(0, 8),
    username: key,
    email: `${key}@test.local`,
    phone: "0000000000",
    role,
    status: "ACTIVE",
    passwordHash: "integration-test-only",
  }).returning({ id: admins.id });
  userIds.push(user.id);
  return user.id;
}

describe("Planner/Admin scheduled assignments", () => {
  it("targets only assigned Executors, deduplicates unchanged saves, isolates companies, and preserves read state", async () => {
    const companyA = await makeCompany("Assignment Company A");
    const companyB = await makeCompany("Assignment Company B");
    const planner = await makeUser(companyA, "Test Planner", "PLANNER");
    const admin = await makeUser(companyA, "Test Admin", "ADMIN");
    const executorA = await makeUser(companyA, "Executor A", "EXECUTION");
    const executorB = await makeUser(companyA, "Executor B", "EXECUTION");
    const foreignExecutor = await makeUser(companyB, "Foreign Executor", "EXECUTION");
    const scheduledAt = new Date("2026-10-01T08:30:00.000Z");

    const plannerAssignment = await createAssignment(companyA, planner, {
      assignedToUserId: executorA,
      title: "Inspect compressor",
      description: "Record pressure and temperature",
      scheduledAt,
    });
    assert.equal((await listNotifications(companyA, executorA)).length, 1);
    assert.equal((await listNotifications(companyA, executorB)).length, 0);

    await createAssignment(companyA, admin, {
      assignedToUserId: executorB,
      title: "Check safety station",
      description: null,
      scheduledAt,
    });
    assert.equal((await listNotifications(companyA, executorB)).length, 1);

    const updated = await updateAssignment(companyA, plannerAssignment.id, planner, {
      title: "Inspect compressor seals",
    });
    assert.equal(updated.notificationCreated, true);
    assert.equal((await listNotifications(companyA, executorA)).length, 2);

    const unchanged = await updateAssignment(companyA, plannerAssignment.id, planner, {
      title: "Inspect compressor seals",
    });
    assert.equal(unchanged.notificationCreated, false);
    assert.equal((await listNotifications(companyA, executorA)).length, 2);

    const cancelled = await cancelAssignment(companyA, plannerAssignment.id, planner);
    assert.equal(cancelled.notificationCreated, true);
    assert.equal((await listNotifications(companyA, executorA)).length, 3);

    await assert.rejects(
      () => createAssignment(companyA, planner, { assignedToUserId: foreignExecutor, title: "Invalid assignment", scheduledAt }),
      /Selected Executor is unavailable/,
    );

    const notifications = await listNotifications(companyA, executorA);
    assert.equal(await getUnreadNotificationCount(companyA, executorA), 3);
    await markNotificationRead(companyA, executorA, notifications[0].id);
    assert.equal(await getUnreadNotificationCount(companyA, executorA), 2);
    await markAllNotificationsRead(companyA, executorA);
    assert.equal(await getUnreadNotificationCount(companyA, executorA), 0);

    const [persisted] = await db.select().from(scheduledAssignments).where(eq(scheduledAssignments.id, plannerAssignment.id));
    assert.equal(persisted.assignedToUserId, executorA);
    assert.equal(persisted.status, "CANCELLED");
  });
});
