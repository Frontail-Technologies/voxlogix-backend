import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { NOTIFICATION_TYPES } from "../src/modules/notifications/notification.domain";
import { sendAdminNotificationBodySchema } from "../src/modules/notifications/notification.validation";

describe("admin notification validation", () => {
  it("requires recipients for selected audience", () => {
    assert.equal(sendAdminNotificationBodySchema.safeParse({ audience: "SELECTED", title: "Update", message: "Check the task." }).success, false);
  });

  it("allows all active Executors to be resolved server-side", () => {
    assert.equal(sendAdminNotificationBodySchema.safeParse({ audience: "ALL", title: "Update", message: "Check the task." }).success, true);
  });

  it("retains the supported notification types", () => {
    assert.equal(NOTIFICATION_TYPES.SCHEDULE_ASSIGNED, "SCHEDULE_ASSIGNED");
    assert.equal(NOTIFICATION_TYPES.ADMIN_ANNOUNCEMENT, "ADMIN_ANNOUNCEMENT");
  });
});
