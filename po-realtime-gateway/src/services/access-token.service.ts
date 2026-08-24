import { Buffer } from "node:buffer";
import { createHmac, timingSafeEqual } from "node:crypto";
import { TOKEN_SETTINGS } from "../config/constants.js";

export type AccessTokenClaims = {
  readonly sub: string;
  readonly exp: number;
  readonly iat: number;
  readonly iss: string;
  readonly aud: string;
};

export class AccessTokenService {
  constructor(private readonly jwtSecret: string) {}

  verify(token: string): AccessTokenClaims {
    const parts = token.split(".");

    if (parts.length !== 3) {
      throw new Error("Invalid access token");
    }

    const [encodedHeader, encodedPayload, signature] = parts;

    if (encodedHeader === undefined || encodedPayload === undefined || signature === undefined) {
      throw new Error("Invalid access token");
    }

    const expectedSignature = createSignature(`${encodedHeader}.${encodedPayload}`, this.jwtSecret);

    if (!safeEqual(signature, expectedSignature)) {
      throw new Error("Invalid access token");
    }

    const claims = parseClaims(encodedPayload);
    const now = Math.floor(Date.now() / 1000);

    if (
      claims.iss !== TOKEN_SETTINGS.issuer ||
      claims.aud !== TOKEN_SETTINGS.audience ||
      claims.exp <= now ||
      claims.iat > now + 60
    ) {
      throw new Error("Invalid access token");
    }

    return claims;
  }
}

function createSignature(value: string, jwtSecret: string): string {
  return createHmac("sha256", jwtSecret).update(value).digest("base64url");
}

function parseClaims(encodedPayload: string): AccessTokenClaims {
  const parsed = JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf8")) as unknown;

  if (!isAccessTokenClaims(parsed)) {
    throw new Error("Invalid access token");
  }

  return parsed;
}

function isAccessTokenClaims(value: unknown): value is AccessTokenClaims {
  return (
    typeof value === "object" &&
    value !== null &&
    "sub" in value &&
    typeof value.sub === "string" &&
    "exp" in value &&
    typeof value.exp === "number" &&
    "iat" in value &&
    typeof value.iat === "number" &&
    "iss" in value &&
    typeof value.iss === "string" &&
    "aud" in value &&
    typeof value.aud === "string"
  );
}

function safeEqual(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}
