export function transcriptForStorage(value: string | null | undefined) {
  if (value === null || value === undefined) return null;
  const trimmed = value.trim();
  return trimmed || null;
}
