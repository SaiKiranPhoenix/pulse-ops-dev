import { createHash, randomBytes } from "node:crypto";

export function createOpaqueToken(prefix: string, byteLength = 32): string {
  return `${prefix}_${randomBytes(byteLength).toString("base64url")}`;
}

export function sha256Hex(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}
