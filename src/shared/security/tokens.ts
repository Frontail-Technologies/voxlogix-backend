import { randomBytes } from "node:crypto";

export function generateToken(bytes = 32) {
  return randomBytes(bytes).toString("hex");
}
