import type { Request } from "express";

export function isMobileClient(request: Request): boolean {
  return (
    request.headers["x-client-platform"] === "mobile" ||
    request.query.client === "mobile"
  );
}
