import type {
  CreateSignedUploadBody,
  DeleteUploadBody,
  UploadAssetBody,
} from "@/modules/uploads/uploads.types";
import { getStorageProvider } from "@/lib/storage";
import { AppError } from "@/shared/errors/app-error";
import { ERROR_CODES } from "@/shared/errors/error-codes";
import { HTTP_STATUS } from "@/shared/errors/http-status";

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

export async function deleteImageAsset(input: DeleteUploadBody) {
  const provider = getStorageProvider();
  return provider.deleteAsset({ key: input.key });
}
