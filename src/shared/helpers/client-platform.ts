import type { Request } from "express";

/** Mobile calls every endpoint with `?client=mobile` (or the `x-client-platform`
 * header) and authenticates via Bearer token in the response body — it never
 * needs or wants cookies. Shared by auth.controller.ts (to avoid setting
 * cookies mobile will never use) and csrf-origin-check.middleware.ts (mobile
 * requests never carry a browser Origin header, so the CSRF check must not
 * apply to them). */
export function isMobileClient(request: Request): boolean {
  return request.headers["x-client-platform"] === "mobile" || request.query.client === "mobile";
}
