import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { API_KEY_LIMITS } from "../config/constants.js";

const publicPrefix = "po_live";

export type GeneratedApiKey = {
  readonly rawKey: string;
  readonly keyPrefix: string;
  readonly keyHash: string;
};

export interface ApiKeyHasher {
  generate(): GeneratedApiKey;
  hash(rawKey: string): string;
  verify(rawKey: string, storedHash: string): boolean;
}

export class HmacApiKeyHasher implements ApiKeyHasher {
  constructor(private readonly pepper: string) {}

  generate(): GeneratedApiKey {
    const randomKey = randomBytes(API_KEY_LIMITS.rawKeyBytes).toString("base64url");
    const rawKey = `${publicPrefix}_${randomKey}`;
    const keyHash = this.hash(rawKey);

    return {
      rawKey,
      keyPrefix: createKeyPrefix(rawKey),
      keyHash,
    };
  }

  hash(rawKey: string): string {
    return createHmac("sha256", this.pepper).update(rawKey).digest("base64url");
  }

  verify(rawKey: string, storedHash: string): boolean {
    const candidateHash = this.hash(rawKey);
    const candidate = Buffer.from(candidateHash);
    const stored = Buffer.from(storedHash);

    return candidate.length === stored.length && timingSafeEqual(candidate, stored);
  }
}

function createKeyPrefix(rawKey: string): string {
  const digest = createHash("sha256").update(rawKey).digest("base64url");
  return `${publicPrefix}_${digest.slice(0, API_KEY_LIMITS.prefixLength)}`;
}
