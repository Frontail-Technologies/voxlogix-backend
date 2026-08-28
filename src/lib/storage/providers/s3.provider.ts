import { randomUUID } from "node:crypto";

import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { Upload } from "@aws-sdk/lib-storage";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

import { env } from "@/config/env";
import type { StorageProvider } from "@/lib/storage/storage.interface";
import type {
  CreateSignedUploadInput,
  CreateSignedUploadResult,
  DeleteAssetInput,
  DeleteAssetResult,
  SignedDownloadInput,
  SignedDownloadResult,
  UploadAssetInput,
  UploadAssetResult,
} from "@/lib/storage/storage.types";
import { buildAssetKey, sanitizeFileName } from "@/lib/storage/storage.utils";
import { AppError } from "@/shared/errors/app-error";
import { ERROR_CODES } from "@/shared/errors/error-codes";
import { HTTP_STATUS } from "@/shared/errors/http-status";

function ensureS3Config() {
  if (
    !env.AWS_ACCESS_KEY_ID ||
    !env.AWS_SECRET_ACCESS_KEY ||
    !env.AWS_S3_REGION ||
    !env.AWS_S3_BUCKET
  ) {
    throw new AppError({
      message: "AWS S3 storage is not configured.",
      statusCode: HTTP_STATUS.INTERNAL_SERVER_ERROR,
      errorCode: ERROR_CODES.INTERNAL_SERVER_ERROR,
    });
  }
}

function createS3Client() {
  ensureS3Config();

  return new S3Client({
    region: env.AWS_S3_REGION,
    credentials: {
      accessKeyId: env.AWS_ACCESS_KEY_ID,
      secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
    },
    endpoint: env.AWS_S3_ENDPOINT || undefined,
    forcePathStyle: Boolean(env.AWS_S3_ENDPOINT),
  });
}

function buildPublicUrl(key: string) {
  if (env.AWS_S3_PUBLIC_BASE_URL) {
    return `${env.AWS_S3_PUBLIC_BASE_URL.replace(/\/+$/g, "")}/${key}`;
  }

  return `https://${env.AWS_S3_BUCKET}.s3.${env.AWS_S3_REGION}.amazonaws.com/${key}`;
}

export class S3StorageProvider implements StorageProvider {
  readonly name = "s3" as const;
  private readonly client = createS3Client();

  async uploadImage(input: UploadAssetInput): Promise<UploadAssetResult> {
    const fileName = sanitizeFileName(input.fileName ?? input.originalName);
    const key = buildAssetKey([
      env.AWS_S3_UPLOAD_PREFIX,
      input.folder,
      input.context,
      `${randomUUID()}-${fileName}`,
    ]);

    const upload = new Upload({
      client: this.client,
      params: {
        Bucket: env.AWS_S3_BUCKET,
        Key: key,
        Body: input.fileBuffer,
        ContentType: input.mimeType,
      },
    });

    await upload.done();

    const publicUrl = buildPublicUrl(key);

    return {
      provider: "s3",
      key,
      url: publicUrl,
      secureUrl: publicUrl,
      mimeType: input.mimeType,
      bytes: input.fileBuffer.byteLength,
      width: null,
      height: null,
      format: null,
      fileName,
    };
  }

  async deleteAsset(input: DeleteAssetInput): Promise<DeleteAssetResult> {
    await this.client.send(
      new DeleteObjectCommand({
        Bucket: env.AWS_S3_BUCKET,
        Key: input.key,
      }),
    );

    return {
      provider: "s3",
      key: input.key,
      deleted: true,
    };
  }

  async createSignedUpload(
    input: CreateSignedUploadInput,
  ): Promise<CreateSignedUploadResult> {
    const fileName = sanitizeFileName(input.fileName);
    const key = buildAssetKey([
      env.AWS_S3_UPLOAD_PREFIX,
      input.folder,
      input.context,
      `${randomUUID()}-${fileName}`,
    ]);
    const expiresInSeconds = 300;

    // Both ContentType and ContentLength become part of the signed request
    // (SigV4 signs whichever headers are present on the command). S3 will
    // reject the client's actual PUT if its Content-Type or Content-Length
    // don't exactly match what was signed here — this is the real
    // enforcement mechanism, not just a client-side hint. It doesn't stop a
    // client from mislabeling a file's true content (no magic-byte check),
    // but it does prevent uploading a type/size other than what passed
    // validation above.
    const command = new PutObjectCommand({
      Bucket: env.AWS_S3_BUCKET,
      Key: key,
      ContentType: input.contentType,
      ContentLength: input.contentLength,
    });

    const uploadUrl = await getSignedUrl(this.client, command, {
      expiresIn: expiresInSeconds,
    });

    return {
      provider: "s3",
      key,
      uploadUrl,
      publicUrl: buildPublicUrl(key),
      expiresInSeconds,
      method: "PUT",
      headers: {
        "Content-Type": input.contentType,
        "Content-Length": String(input.contentLength),
      },
    };
  }

  async createSignedDownloadUrl(input: SignedDownloadInput): Promise<SignedDownloadResult> {
    const expiresInSeconds = 600; // 10 minutes
    const command = new GetObjectCommand({ Bucket: env.AWS_S3_BUCKET, Key: input.key });
    const url = await getSignedUrl(this.client, command, { expiresIn: expiresInSeconds });

    return { provider: "s3", url, expiresInSeconds };
  }
}
