import { v2 as cloudinary, type UploadApiResponse } from "cloudinary";

import { env } from "@/config/env";
import type { StorageProvider } from "@/lib/storage/storage.interface";
import type {
  DeleteAssetInput,
  DeleteAssetResult,
  UploadAssetInput,
  UploadAssetResult,
} from "@/lib/storage/storage.types";
import { buildAssetKey, sanitizeFileName } from "@/lib/storage/storage.utils";
import { AppError } from "@/shared/errors/app-error";
import { ERROR_CODES } from "@/shared/errors/error-codes";
import { HTTP_STATUS } from "@/shared/errors/http-status";

function cloudinaryCredentials() {
  return {
    cloudName: env.CLOUDINARY_CLOUD_NAME.trim(),
    apiKey: env.CLOUDINARY_API_KEY.trim(),
    apiSecret: env.CLOUDINARY_API_SECRET.trim(),
  };
}

function ensureCloudinaryConfig() {
  const credentials = cloudinaryCredentials();

  if (!credentials.cloudName || !credentials.apiKey || !credentials.apiSecret) {
    throw new AppError({
      message: "Cloudinary storage is not configured.",
      statusCode: HTTP_STATUS.INTERNAL_SERVER_ERROR,
      errorCode: ERROR_CODES.INTERNAL_SERVER_ERROR,
    });
  }

  return credentials;
}

function mapUploadResult(result: UploadApiResponse, mimeType: string, fileName: string): UploadAssetResult {
  return {
    provider: "cloudinary",
    key: result.public_id,
    url: result.url,
    secureUrl: result.secure_url,
    mimeType,
    bytes: result.bytes,
    width: result.width,
    height: result.height,
    format: result.format,
    fileName,
  };
}

export class CloudinaryStorageProvider implements StorageProvider {
  readonly name = "cloudinary" as const;
  private readonly credentials = ensureCloudinaryConfig();

  constructor() {
    cloudinary.config({
      cloud_name: this.credentials.cloudName,
      api_key: this.credentials.apiKey,
      api_secret: this.credentials.apiSecret,
      secure: true,
    });
  }

  async uploadImage(input: UploadAssetInput) {
    const folder = buildAssetKey([
      env.CLOUDINARY_UPLOAD_FOLDER.trim(),
      input.folder,
      input.context,
    ]);
    const fileName = sanitizeFileName(input.fileName ?? input.originalName);
    const publicId = fileName.replace(/\.[^.]+$/, "");

    return new Promise<UploadAssetResult>((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        {
          cloud_name: this.credentials.cloudName,
          api_key: this.credentials.apiKey,
          api_secret: this.credentials.apiSecret,
          folder,
          public_id: publicId,
          overwrite: true,
          resource_type: input.resourceType ?? "image",
          invalidate: true,
          unsigned: false,
        },
        (error, result) => {
          if (error || !result) {
            reject(
              new AppError({
                message: error?.message || "Cloudinary upload failed.",
                statusCode: HTTP_STATUS.BAD_REQUEST,
                errorCode: ERROR_CODES.INTERNAL_SERVER_ERROR,
              }),
            );
            return;
          }

          resolve(mapUploadResult(result, input.mimeType, fileName));
        },
      );

      stream.end(input.fileBuffer);
    });
  }

  async deleteAsset(input: DeleteAssetInput): Promise<DeleteAssetResult> {
    const result = await cloudinary.uploader.destroy(input.key, {
      invalidate: true,
      resource_type: input.resourceType ?? "image",
    });

    return {
      provider: "cloudinary",
      key: input.key,
      deleted: result.result === "ok" || result.result === "not found",
    };
  }
}

