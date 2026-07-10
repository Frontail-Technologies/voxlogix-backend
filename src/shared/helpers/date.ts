export function toIsoString(value: Date | string | number) {
  return new Date(value).toISOString();
}

export function nowIso() {
  return new Date().toISOString();
}
