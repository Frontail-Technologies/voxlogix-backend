import type {
  CreateSignedUploadInput,
  CreateSignedUploadResult,
  DeleteAssetInput,
  DeleteAssetResult,
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
}
