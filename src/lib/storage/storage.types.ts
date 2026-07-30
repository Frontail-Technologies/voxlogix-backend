export type StorageProviderName = "cloudinary" | "s3";

export type StorageAssetContext =
  | "company-logo"
  | "admin-avatar"
  | "module-media"
  | "generic-image"
  | "log-attachment"
  | "voice-recording"
  | "equipment-manual";

export type UploadAssetInput = {
  fileBuffer: Buffer;
  mimeType: string;
  originalName: string;
  folder?: string;
  fileName?: string;
  context?: StorageAssetContext;
  resourceType?: "image" | "video" | "raw";
};

export type UploadAssetResult = {
  provider: StorageProviderName;
  key: string;
  url: string;
  secureUrl: string;
  mimeType: string;
  bytes: number;
  width?: number | null;
  height?: number | null;
  format?: string | null;
  fileName?: string | null;
};

export type DeleteAssetInput = {
  key: string;
  resourceType?: "image" | "video" | "raw";
};

export type DeleteAssetResult = {
  provider: StorageProviderName;
  key: string;
  deleted: boolean;
};

export type CreateSignedUploadInput = {
  fileName: string;
  contentType: string;
  folder?: string;
  context?: StorageAssetContext;
};

export type CreateSignedUploadResult = {
  provider: StorageProviderName;
  key: string;
  uploadUrl: string;
  publicUrl: string;
  expiresInSeconds: number;
  method: "PUT";
  headers: Record<string, string>;
};
