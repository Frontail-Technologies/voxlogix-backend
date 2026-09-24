import { NOTIFICATION_TYPES } from "@/modules/notifications/notification.domain";

export const ASSIGNMENT_STATUS = {
  SCHEDULED: "SCHEDULED",
  CANCELLED: "CANCELLED",
  COMPLETED: "COMPLETED",
} as const;

export type AssignmentNotificationEvent = "ASSIGNED" | "UPDATED" | "CANCELLED";

type AssignmentDetails = {
  title: string;
  description?: string | null;
  scheduledAt: Date;
};

type AssignmentComparable = AssignmentDetails & {
  assignedToUserId: string;
};

export function normalizeAssignmentDescription(value?: string | null) {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

export function hasMeaningfulAssignmentChange(current: AssignmentComparable, next: AssignmentComparable) {
  return current.assignedToUserId !== next.assignedToUserId
    || current.title.trim() !== next.title.trim()
    || normalizeAssignmentDescription(current.description) !== normalizeAssignmentDescription(next.description)
    || current.scheduledAt.getTime() !== next.scheduledAt.getTime();
}

export function buildAssignmentNotification(event: AssignmentNotificationEvent, assignment: AssignmentDetails) {
  const notificationByEvent = {
    ASSIGNED: { type: NOTIFICATION_TYPES.SCHEDULE_ASSIGNED, title: "New work scheduled" },
    UPDATED: { type: NOTIFICATION_TYPES.SCHEDULE_UPDATED, title: "Schedule updated" },
    CANCELLED: { type: NOTIFICATION_TYPES.SCHEDULE_CANCELLED, title: "Schedule cancelled" },
  } as const;
  const dateTime = new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC",
  }).format(assignment.scheduledAt);
  const details = [assignment.title.trim(), `${dateTime} UTC`];
  const description = normalizeAssignmentDescription(assignment.description);
  if (description) details.push(description);

  return { ...notificationByEvent[event], message: details.join("\n") };
}
