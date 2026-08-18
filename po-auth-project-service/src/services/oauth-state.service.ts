import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { badRequest } from "@pulseops/shared";
import { OAUTH_LIMITS } from "../config/constants.js";
import type { OAuthProvider } from "../models/user.model.js";

type OAuthStatePayload = {
  readonly provider: OAuthProvider;
  readonly nonce: string;
  readonly iat: number;
};

export interface OAuthStateService {
  create(provider: OAuthProvider): string;
  verify(state: string, provider: OAuthProvider): void;
}

export class HmacOAuthStateService implements OAuthStateService {
  constructor(
    private readonly secret: string,
    private readonly ttlSeconds: number = OAUTH_LIMITS.stateTtlSeconds,
  ) {}

  create(provider: OAuthProvider): string {
    const payload: OAuthStatePayload = {
      provider,
      nonce: randomBytes(OAUTH_LIMITS.stateNonceBytes).toString("base64url"),
      iat: Math.floor(Date.now() / 1000),
    };
    const encodedPayload = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");

    return `${encodedPayload}.${sign(encodedPayload, this.secret)}`;
  }

  verify(state: string, provider: OAuthProvider): void {
    const [encodedPayload, signature] = state.split(".");

    if (encodedPayload === undefined || signature === undefined || state.split(".").length !== 2) {
      throw badRequest("Invalid OAuth state");
    }

    const expectedSignature = sign(encodedPayload, this.secret);

    if (!safeEqual(signature, expectedSignature)) {
      throw badRequest("Invalid OAuth state");
    }

    const payload = parsePayload(encodedPayload);
    const now = Math.floor(Date.now() / 1000);

    if (
      payload.provider !== provider ||
      payload.iat > now + 60 ||
      payload.iat + this.ttlSeconds < now
    ) {
      throw badRequest("Invalid OAuth state");
    }
  }
}

function sign(value: string, secret: string): string {
  return createHmac("sha256", secret).update(value).digest("base64url");
}

function parsePayload(encodedPayload: string): OAuthStatePayload {
  try {
    const payload = JSON.parse(
      Buffer.from(encodedPayload, "base64url").toString("utf8"),
    ) as Partial<OAuthStatePayload>;

    if (
      (payload.provider !== "google" && payload.provider !== "github") ||
      typeof payload.nonce !== "string" ||
      typeof payload.iat !== "number"
    ) {
      throw new Error("Malformed OAuth state");
    }

    return payload as OAuthStatePayload;
  } catch {
    throw badRequest("Invalid OAuth state");
  }
}

function safeEqual(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}
