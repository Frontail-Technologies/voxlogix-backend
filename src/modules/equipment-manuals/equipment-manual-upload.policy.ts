export const EQUIPMENT_MANUAL_MAX_FILE_SIZE_MB = 10;
export const EQUIPMENT_MANUAL_MAX_FILE_SIZE_BYTES =
  EQUIPMENT_MANUAL_MAX_FILE_SIZE_MB * 1024 * 1024;

export const EQUIPMENT_MANUAL_SIZE_ERROR = `PDF must be ${EQUIPMENT_MANUAL_MAX_FILE_SIZE_MB} MB or smaller.`;
export const EQUIPMENT_MANUAL_TYPE_ERROR = "Only PDF manual files are allowed.";

export function isManualFileSizeAllowed(size: number) {
  return size >= 0 && size <= EQUIPMENT_MANUAL_MAX_FILE_SIZE_BYTES;
}

export function isPdfManualDescriptor(input: {
  mimeType: string;
  fileName: string;
}) {
  return (
    input.mimeType.toLowerCase() === "application/pdf" &&
    input.fileName.toLowerCase().endsWith(".pdf")
  );
}

export function hasPdfSignature(buffer: Buffer) {
  return buffer.length >= 5 && buffer.subarray(0, 5).toString("ascii") === "%PDF-";
}
