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
    .map((part) => String(part).replace(/^\/+|\/+$/g, ""))
    .filter(Boolean)
    .join("/");
}
