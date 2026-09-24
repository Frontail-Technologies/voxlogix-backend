import { and, asc, desc, eq, ilike, or } from "drizzle-orm";

import { db } from "@/db";
import { admins, inAppNotifications, scheduledAssignments } from "@/db/schema";
import {
  ASSIGNMENT_STATUS,
  buildAssignmentNotification,
  hasMeaningfulAssignmentChange,
  normalizeAssignmentDescription,
  type AssignmentNotificationEvent,
} from "@/modules/assignments/assignment.domain";
import type { CreateAssignmentInput, UpdateAssignmentInput } from "@/modules/assignments/assignment.validation";
import { USER_ROLES, USER_STATUS } from "@/shared/constants";
import { AppError } from "@/shared/errors/app-error";
import { ERROR_CODES } from "@/shared/errors/error-codes";
import { HTTP_STATUS } from "@/shared/errors/http-status";

async function requireActiveExecutor(companyId: string, userId: string) {
  const [executor] = await db.select({ id: admins.id }).from(admins).where(and(
    eq(admins.id, userId),
    eq(admins.companyId, companyId),
    eq(admins.role, USER_ROLES.EXECUTION),
    eq(admins.status, USER_STATUS.ACTIVE),
  )).limit(1);
  if (!executor) {
    throw new AppError({
      message: "Selected Executor is unavailable.",
      statusCode: HTTP_STATUS.BAD_REQUEST,
      errorCode: ERROR_CODES.VALIDATION_ERROR,
    });
  }
  return executor;
}

async function requireAssignment(companyId: string, assignmentId: string) {
  const [assignment] = await db.select().from(scheduledAssignments).where(and(
    eq(scheduledAssignments.id, assignmentId),
    eq(scheduledAssignments.companyId, companyId),
  )).limit(1);
  if (!assignment) {
    throw new AppError({ message: "Assignment not found.", statusCode: HTTP_STATUS.NOT_FOUND, errorCode: ERROR_CODES.NOT_FOUND });
  }
  return assignment;
}

function assignmentSelection() {
  return {
    id: scheduledAssignments.id,
    companyId: scheduledAssignments.companyId,
    title: scheduledAssignments.title,
    description: scheduledAssignments.description,
    assignedToUserId: scheduledAssignments.assignedToUserId,
    assignedByUserId: scheduledAssignments.assignedByUserId,
    scheduledAt: scheduledAssignments.scheduledAt,
    status: scheduledAssignments.status,
    createdAt: scheduledAssignments.createdAt,
    updatedAt: scheduledAssignments.updatedAt,
    assignedTo: {
      id: admins.id,
      fullName: admins.fullName,
      email: admins.email,
      avatarUrl: admins.avatarUrl,
    },
  };
}

async function createNotification(
  transaction: Parameters<Parameters<typeof db.transaction>[0]>[0],
  assignment: typeof scheduledAssignments.$inferSelect,
  actorId: string,
  event: AssignmentNotificationEvent,
) {
  const notification = buildAssignmentNotification(event, assignment);
  await transaction.insert(inAppNotifications).values({
    companyId: assignment.companyId,
    recipientUserId: assignment.assignedToUserId,
    createdByUserId: actorId,
    ...notification,
    relatedEntityType: "SCHEDULED_ASSIGNMENT",
    relatedEntityId: assignment.id,
    relatedRoute: null,
  });
}

export async function listAssignments(companyId: string, status?: string) {
  const filters = [eq(scheduledAssignments.companyId, companyId)];
  if (status) filters.push(eq(scheduledAssignments.status, status));
  return db.select(assignmentSelection()).from(scheduledAssignments)
    .innerJoin(admins, eq(scheduledAssignments.assignedToUserId, admins.id))
    .where(and(...filters))
    .orderBy(desc(scheduledAssignments.scheduledAt));
}

export async function listAssignmentExecutors(companyId: string, search?: string) {
  const filters = [
    eq(admins.companyId, companyId),
    eq(admins.role, USER_ROLES.EXECUTION),
    eq(admins.status, USER_STATUS.ACTIVE),
  ];
  if (search) filters.push(or(ilike(admins.fullName, `%${search}%`), ilike(admins.email, `%${search}%`))!);
  return db.select({ id: admins.id, fullName: admins.fullName, email: admins.email, avatarUrl: admins.avatarUrl })
    .from(admins)
    .where(and(...filters))
    .orderBy(asc(admins.fullName))
    .limit(100);
}

export async function getAssignment(companyId: string, assignmentId: string) {
  const [assignment] = await db.select(assignmentSelection()).from(scheduledAssignments)
    .innerJoin(admins, eq(scheduledAssignments.assignedToUserId, admins.id))
    .where(and(eq(scheduledAssignments.id, assignmentId), eq(scheduledAssignments.companyId, companyId)))
    .limit(1);
  if (!assignment) {
    throw new AppError({ message: "Assignment not found.", statusCode: HTTP_STATUS.NOT_FOUND, errorCode: ERROR_CODES.NOT_FOUND });
  }
  return assignment;
}

export async function createAssignment(companyId: string, actorId: string, input: CreateAssignmentInput) {
  await requireActiveExecutor(companyId, input.assignedToUserId);
  const assignmentId = await db.transaction(async (transaction) => {
    const [created] = await transaction.insert(scheduledAssignments).values({
      companyId,
      assignedByUserId: actorId,
      assignedToUserId: input.assignedToUserId,
      title: input.title.trim(),
      description: normalizeAssignmentDescription(input.description),
      scheduledAt: input.scheduledAt,
      status: ASSIGNMENT_STATUS.SCHEDULED,
    }).returning();
    await createNotification(transaction, created, actorId, "ASSIGNED");
    return created.id;
  });
  return getAssignment(companyId, assignmentId);
}

export async function updateAssignment(companyId: string, assignmentId: string, actorId: string, input: UpdateAssignmentInput) {
  const current = await requireAssignment(companyId, assignmentId);
  if (current.status !== ASSIGNMENT_STATUS.SCHEDULED) {
    throw new AppError({ message: "Only scheduled assignments can be updated.", statusCode: HTTP_STATUS.CONFLICT, errorCode: ERROR_CODES.CONFLICT });
  }

  const next = {
    assignedToUserId: input.assignedToUserId ?? current.assignedToUserId,
    title: input.title ?? current.title,
    description: input.description === undefined ? current.description : normalizeAssignmentDescription(input.description),
    scheduledAt: input.scheduledAt ?? current.scheduledAt,
  };
  await requireActiveExecutor(companyId, next.assignedToUserId);
  if (!hasMeaningfulAssignmentChange(current, next)) {
    return { assignment: await getAssignment(companyId, assignmentId), notificationCreated: false };
  }

  await db.transaction(async (transaction) => {
    const [updated] = await transaction.update(scheduledAssignments).set({ ...next, updatedAt: new Date() }).where(and(
      eq(scheduledAssignments.id, assignmentId),
      eq(scheduledAssignments.companyId, companyId),
      eq(scheduledAssignments.status, ASSIGNMENT_STATUS.SCHEDULED),
    )).returning();
    if (!updated) {
      throw new AppError({ message: "Assignment is no longer available for update.", statusCode: HTTP_STATUS.CONFLICT, errorCode: ERROR_CODES.CONFLICT });
    }
    await createNotification(transaction, updated, actorId, "UPDATED");
  });
  return { assignment: await getAssignment(companyId, assignmentId), notificationCreated: true };
}

export async function cancelAssignment(companyId: string, assignmentId: string, actorId: string) {
  const current = await requireAssignment(companyId, assignmentId);
  if (current.status === ASSIGNMENT_STATUS.CANCELLED) {
    return { assignment: await getAssignment(companyId, assignmentId), notificationCreated: false };
  }
  if (current.status !== ASSIGNMENT_STATUS.SCHEDULED) {
    throw new AppError({ message: "Only scheduled assignments can be cancelled.", statusCode: HTTP_STATUS.CONFLICT, errorCode: ERROR_CODES.CONFLICT });
  }

  await db.transaction(async (transaction) => {
    const [cancelled] = await transaction.update(scheduledAssignments).set({
      status: ASSIGNMENT_STATUS.CANCELLED,
      updatedAt: new Date(),
    }).where(and(
      eq(scheduledAssignments.id, assignmentId),
      eq(scheduledAssignments.companyId, companyId),
      eq(scheduledAssignments.status, ASSIGNMENT_STATUS.SCHEDULED),
    )).returning();
    if (!cancelled) {
      throw new AppError({ message: "Assignment is no longer available for cancellation.", statusCode: HTTP_STATUS.CONFLICT, errorCode: ERROR_CODES.CONFLICT });
    }
    await createNotification(transaction, cancelled, actorId, "CANCELLED");
  });
  return { assignment: await getAssignment(companyId, assignmentId), notificationCreated: true };
}
