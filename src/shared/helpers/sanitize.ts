export function sanitizeString(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

export function sanitizeNullableString(value?: string | null) {
  if (!value) {
    return null;
  }

  const sanitized = sanitizeString(value);
  return sanitized.length ? sanitized : null;
}
