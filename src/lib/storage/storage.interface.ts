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

export interface StorageProvider {
  readonly name: "cloudinary" | "s3";
  uploadImage(input: UploadAssetInput): Promise<UploadAssetResult>;
  deleteAsset(input: DeleteAssetInput): Promise<DeleteAssetResult>;
  createSignedUpload?(
    input: CreateSignedUploadInput,
  ): Promise<CreateSignedUploadResult>;
  /** A time-limited signed URL for reading an existing object. Note: for
   * Cloudinary this only actually restricts access for assets uploaded with
   * `type: "authenticated"` — assets uploaded the default way (every asset
   * uploaded before, and still, today) remain reachable via their own plain
   * public URL regardless of this. See security hardening report. */
  createSignedDownloadUrl(input: SignedDownloadInput): Promise<SignedDownloadResult>;
}
