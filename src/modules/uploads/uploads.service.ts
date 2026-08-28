import { eq } from "drizzle-orm";

import { db } from "@/db";
import { admins, companies, equipmentManuals, logAttachments, modules, operationalLogs, platformGeneralSettings } from "@/db/schema";
import type {
  CreateSignedUploadBody,
  DeleteUploadBody,
  UploadAssetBody,
} from "@/modules/uploads/uploads.types";
import { getStorageProvider } from "@/lib/storage";
import { AppError } from "@/shared/errors/app-error";
import { ERROR_CODES } from "@/shared/errors/error-codes";
import { HTTP_STATUS } from "@/shared/errors/http-status";
import { USER_ROLES } from "@/shared/constants";

export async function uploadImageAsset(
  file: Express.Multer.File,
  input: UploadAssetBody,
) {
  const provider = getStorageProvider();

  return provider.uploadImage({
    fileBuffer: file.buffer,
    mimeType: file.mimetype,
    originalName: file.originalname,
    folder: input.folder,
    fileName: input.fileName,
    context: input.context,
  });
}

export async function uploadAudioAsset(
  file: Express.Multer.File,
  input: UploadAssetBody,
) {
  const provider = getStorageProvider();

  return provider.uploadImage({
    fileBuffer: file.buffer,
    mimeType: file.mimetype,
    originalName: file.originalname,
    folder: input.folder,
    fileName: input.fileName,
    context: input.context,
    resourceType: "video",
  });
}

export async function uploadDocumentAsset(
  file: Express.Multer.File,
  input: UploadAssetBody,
) {
  const provider = getStorageProvider();

  return provider.uploadImage({
    fileBuffer: file.buffer,
    mimeType: file.mimetype,
    originalName: file.originalname,
    folder: input.folder,
    fileName: input.fileName,
    context: input.context,
    resourceType: "raw",
  });
}

export async function createSignedImageUpload(input: CreateSignedUploadBody) {
  const provider = getStorageProvider();

  if (!provider.createSignedUpload) {
    throw new AppError({
      message: "Signed uploads are only available for the active storage provider when supported.",
      statusCode: HTTP_STATUS.BAD_REQUEST,
      errorCode: ERROR_CODES.VALIDATION_ERROR,
    });
  }

  return provider.createSignedUpload(input);
}

/** Raw storage delete with NO ownership check — for trusted, server-initiated
 * cleanup only (e.g. deleting an attachment's file after its owning DB row
 * has already been authoritatively deleted, at which point resolveAssetOwner
 * would find nothing to check against since the record is gone). Never call
 * this directly from a request handler with a client-supplied key — use
 * deleteImageAsset for anything reachable from user input. */
export async function deleteStorageAssetByKey(key: string) {
  const provider = getStorageProvider();
  return provider.deleteAsset({ key });
}

type AssetOwner = { scope: "company"; companyId: string } | { scope: "platform" };

// The storage layer has no single unified "assets" table — every uploaded
// file's key already lives as a column on whichever record owns it
// (log_attachments.key, operational_logs.voice_recording_key,
// equipment_manuals.file_key, admins.avatar_key, companies.logo_key,
// modules.media_key, platform_general_settings.logo_key). Rather than
// introduce a new table that duplicates that ownership data (and wouldn't
// retroactively cover already-uploaded assets without a backfill), this
// resolves ownership by checking each of those existing columns directly.
async function resolveAssetOwner(key: string): Promise<AssetOwner | null> {
  const [attachment] = await db
    .select({ companyId: operationalLogs.companyId })
    .from(logAttachments)
    .innerJoin(operationalLogs, eq(logAttachments.logId, operationalLogs.id))
    .where(eq(logAttachments.key, key))
    .limit(1);
  if (attachment) return { scope: "company", companyId: attachment.companyId };

  const [log] = await db.select({ companyId: operationalLogs.companyId }).from(operationalLogs).where(eq(operationalLogs.voiceRecordingKey, key)).limit(1);
  if (log) return { scope: "company", companyId: log.companyId };

  const [manual] = await db.select({ companyId: equipmentManuals.companyId }).from(equipmentManuals).where(eq(equipmentManuals.fileKey, key)).limit(1);
  if (manual) return { scope: "company", companyId: manual.companyId };

  const [admin] = await db.select({ companyId: admins.companyId }).from(admins).where(eq(admins.avatarKey, key)).limit(1);
  if (admin) return { scope: "company", companyId: admin.companyId };

  const [company] = await db.select({ id: companies.id }).from(companies).where(eq(companies.logoKey, key)).limit(1);
  if (company) return { scope: "company", companyId: company.id };

  const [moduleRow] = await db.select({ id: modules.id }).from(modules).where(eq(modules.mediaKey, key)).limit(1);
  if (moduleRow) return { scope: "platform" };

  const [generalSettings] = await db.select({ id: platformGeneralSettings.id }).from(platformGeneralSettings).where(eq(platformGeneralSettings.logoKey, key)).limit(1);
  if (generalSettings) return { scope: "platform" };

  return null;
}

/** Resolves who owns `key` and throws if the caller isn't authorized to act
 * on it — shared by delete and signed-URL issuance so both enforce the same
 * rule. Throws 404 if the key isn't referenced by any known record (nothing
 * to authorize against), 403 if it belongs to a different company/scope. */
async function authorizeAssetAccess(key: string, caller: { companyId?: string; role: string }) {
  const owner = await resolveAssetOwner(key);

  if (!owner) {
    throw new AppError({
      message: "Asset not found.",
      statusCode: HTTP_STATUS.NOT_FOUND,
      errorCode: ERROR_CODES.NOT_FOUND,
    });
  }

  const isMaster = caller.role === USER_ROLES.MASTER;
  const forbidden =
    owner.scope === "platform" ? !isMaster : !isMaster && owner.companyId !== caller.companyId;

  if (forbidden) {
    throw new AppError({
      message: "You do not have permission to access this asset.",
      statusCode: HTTP_STATUS.FORBIDDEN,
      errorCode: ERROR_CODES.FORBIDDEN,
    });
  }
}

export async function getSignedMediaUrl(key: string, resourceType: "image" | "video" | "raw" | undefined, caller: { companyId?: string; role: string }) {
  await authorizeAssetAccess(key, caller);
  const provider = getStorageProvider();
  return provider.createSignedDownloadUrl({ key, resourceType });
}

export async function deleteImageAsset(input: DeleteUploadBody, caller: { companyId?: string; role: string }) {
  await authorizeAssetAccess(input.key, caller);

  const provider = getStorageProvider();
  return provider.deleteAsset({ key: input.key });
}
