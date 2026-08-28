import path from "node:path";

export function sanitizeFileName(value: string) {
  const extension = path.extname(value).toLowerCase();
  const baseName = path.basename(value, extension);

  const sanitizedBase = baseName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);

  const safeExtension = extension.replace(/[^a-z0-9.]/g, "").slice(0, 10);

  return `${sanitizedBase || "file"}${safeExtension || ""}`;
}

export function buildAssetKey(parts: Array<string | undefined>) {
  return parts
    .filter(Boolean)
    .map((part) =>
      String(part)
        .replace(/^\/+|\/+$/g, "")
        // Object keys are opaque strings to S3/Cloudinary (not resolved
        // through a real filesystem), so this isn't an actual traversal
        // escape — stripped anyway so a caller-supplied folder/context value
        // can never produce a confusing "../.."-bearing key.
        .split("/")
        .filter((segment) => segment !== "." && segment !== "..")
        .join("/"),
    )
    .filter(Boolean)
    .join("/");
}
