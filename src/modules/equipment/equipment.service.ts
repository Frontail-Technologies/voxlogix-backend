import { and, asc, count, eq, ilike, or, type SQL } from "drizzle-orm";

import { db } from "@/db";
import { equipmentAssets, locations } from "@/db/schema";
import type {
  CreateEquipmentInput,
  ListEquipmentInput,
  UpdateEquipmentInput,
} from "@/modules/equipment/equipment.types";
import { AppError } from "@/shared/errors/app-error";
import { ERROR_CODES } from "@/shared/errors/error-codes";
import { HTTP_STATUS } from "@/shared/errors/http-status";
import { buildPagination } from "@/shared/helpers/pagination";
import { sanitizeString } from "@/shared/helpers/sanitize";

function buildEquipmentFilter(input: Omit<ListEquipmentInput, "page" | "limit">) {
  const filters: SQL<unknown>[] = [eq(equipmentAssets.companyId, input.companyId)];

  if (input.search) {
    filters.push(
      or(
        ilike(equipmentAssets.equipmentCode, `%${input.search}%`),
        ilike(equipmentAssets.name, `%${input.search}%`),
        ilike(equipmentAssets.category, `%${input.search}%`),
      )!,
    );
  }

  if (input.status) filters.push(eq(equipmentAssets.status, input.status));
  if (input.criticality) filters.push(eq(equipmentAssets.criticality, input.criticality));
  if (input.section) filters.push(eq(equipmentAssets.section, input.section));

  return and(...filters);
}

async function ensureEquipment(companyId: string, equipmentId: string) {
  const [existing] = await db
    .select({ id: equipmentAssets.id })
    .from(equipmentAssets)
    .where(and(eq(equipmentAssets.id, equipmentId), eq(equipmentAssets.companyId, companyId)))
    .limit(1);

  if (!existing) {
    throw new AppError({
      message: "Equipment not found.",
      statusCode: HTTP_STATUS.NOT_FOUND,
      errorCode: ERROR_CODES.NOT_FOUND,
    });
  }
}

export async function listEquipment(input: ListEquipmentInput) {
  const where = buildEquipmentFilter(input);
  const [{ totalItems }] = await db.select({ totalItems: count() }).from(equipmentAssets).where(where);
  const pagination = buildPagination({ page: input.page, limit: input.limit, totalItems });

  const rows = await db
    .select({
      id: equipmentAssets.id,
      equipmentCode: equipmentAssets.equipmentCode,
      name: equipmentAssets.name,
      category: equipmentAssets.category,
      section: equipmentAssets.section,
      subLocation: equipmentAssets.subLocation,
      criticality: equipmentAssets.criticality,
      status: equipmentAssets.status,
      imageUrl: equipmentAssets.imageUrl,
      latitude: equipmentAssets.latitude,
      longitude: equipmentAssets.longitude,
      mapUrl: equipmentAssets.mapUrl,
      updatedAt: equipmentAssets.updatedAt,
    })
    .from(equipmentAssets)
    .where(where)
    .orderBy(asc(equipmentAssets.name))
    .limit(pagination.limit)
    .offset(pagination.offset);

  return { items: rows, pagination };
}

export async function getEquipment(companyId: string, equipmentId: string) {
  const [row] = await db
    .select({
      id: equipmentAssets.id,
      locationId: equipmentAssets.locationId,
      equipmentCode: equipmentAssets.equipmentCode,
      name: equipmentAssets.name,
      category: equipmentAssets.category,
      section: equipmentAssets.section,
      subLocation: equipmentAssets.subLocation,
      makeBrand: equipmentAssets.makeBrand,
      modelNumber: equipmentAssets.modelNumber,
      criticality: equipmentAssets.criticality,
      status: equipmentAssets.status,
      imageUrl: equipmentAssets.imageUrl,
      latitude: equipmentAssets.latitude,
      longitude: equipmentAssets.longitude,
      mapUrl: equipmentAssets.mapUrl,
      notes: equipmentAssets.notes,
      manualUrl: equipmentAssets.manualUrl,
      manualText: equipmentAssets.manualText,
      commissionedAt: equipmentAssets.commissionedAt,
      location: {
        id: locations.id,
        plant: locations.plant,
        unit: locations.unit,
        section: locations.section,
        subLocation: locations.subLocation,
      },
      createdAt: equipmentAssets.createdAt,
      updatedAt: equipmentAssets.updatedAt,
    })
    .from(equipmentAssets)
    .leftJoin(locations, eq(equipmentAssets.locationId, locations.id))
    .where(and(eq(equipmentAssets.id, equipmentId), eq(equipmentAssets.companyId, companyId)))
    .limit(1);

  if (!row) {
    throw new AppError({ message: "Equipment not found.", statusCode: HTTP_STATUS.NOT_FOUND, errorCode: ERROR_CODES.NOT_FOUND });
  }

  return row;
}

export async function createEquipment(input: CreateEquipmentInput) {
  const [created] = await db
    .insert(equipmentAssets)
    .values({
      companyId: input.companyId,
      locationId: input.locationId ?? null,
      equipmentCode: sanitizeString(input.equipmentCode),
      name: sanitizeString(input.name),
      category: sanitizeString(input.category),
      section: sanitizeString(input.section),
      subLocation: sanitizeString(input.subLocation),
      makeBrand: input.makeBrand ? sanitizeString(input.makeBrand) : null,
      modelNumber: input.modelNumber ? sanitizeString(input.modelNumber) : null,
      criticality: input.criticality,
      status: input.status,
      imageUrl: input.imageUrl ?? null,
      latitude: input.latitude ?? null,
      longitude: input.longitude ?? null,
      mapUrl: input.mapUrl ?? null,
      notes: input.notes ? sanitizeString(input.notes) : null,
      manualUrl: input.manualUrl ?? null,
      manualText: input.manualText ? input.manualText.trim() : null,
      commissionedAt: input.commissionedAt ?? null,
      updatedAt: new Date(),
    })
    .returning({ id: equipmentAssets.id });

  return getEquipment(input.companyId, created.id);
}

export async function updateEquipment(companyId: string, equipmentId: string, input: UpdateEquipmentInput) {
  await ensureEquipment(companyId, equipmentId);

  await db
    .update(equipmentAssets)
    .set({ ...input, updatedAt: new Date() })
    .where(and(eq(equipmentAssets.id, equipmentId), eq(equipmentAssets.companyId, companyId)));

  return getEquipment(companyId, equipmentId);
}

export async function deleteEquipment(companyId: string, equipmentId: string) {
  await ensureEquipment(companyId, equipmentId);
  await db
    .delete(equipmentAssets)
    .where(and(eq(equipmentAssets.id, equipmentId), eq(equipmentAssets.companyId, companyId)));
  return { id: equipmentId };
}
