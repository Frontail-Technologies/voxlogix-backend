import { env } from "@/config/env";
import type { StorageProvider } from "@/lib/storage/storage.interface";
import { CloudinaryStorageProvider } from "@/lib/storage/providers/cloudinary.provider";
import { S3StorageProvider } from "@/lib/storage/providers/s3.provider";

let providerInstance: StorageProvider | null = null;

export function getStorageProvider() {
  if (providerInstance) {
    return providerInstance;
  }

  providerInstance =
    env.STORAGE_PROVIDER === "s3"
      ? new S3StorageProvider()
      : new CloudinaryStorageProvider();

  return providerInstance;
}
