import { createHmac } from "node:crypto";
import { forbidden, unauthorized } from "@pulseops/shared";
import type {
  IngestionApiKeyRepository,
  VerifiedIngestionApiKey,
} from "../repositories/ingestion-api-key.repository.js";
import type { ApiKeyValidationCacheRepository } from "../repositories/api-key-cache.repository.js";

export type ApiKeyContext = {
  readonly projectId: string;
  readonly ownerId: string;
  readonly scopes: string[];
};

export class ApiKeyAuthenticatorService {
  constructor(
    private readonly apiKeys: IngestionApiKeyRepository,
    private readonly pepper: string,
    private readonly cache?: ApiKeyValidationCacheRepository,
  ) {}

  async authenticate(rawApiKey: string, requiredScope: string): Promise<ApiKeyContext> {
    const keyHash = this.hash(rawApiKey);
    const apiKey = await this.findApiKey(keyHash);

    if (apiKey === null) {
      throw unauthorized("Invalid API key");
    }

    if (apiKey.expiresAt !== null && apiKey.expiresAt.getTime() <= Date.now()) {
      throw unauthorized("Invalid API key");
    }

    this.assertScope(apiKey, requiredScope);

    return {
      projectId: apiKey.projectId,
      ownerId: apiKey.ownerId,
      scopes: [...apiKey.scopes],
    };
  }

  private hash(rawApiKey: string): string {
    return createHmac("sha256", this.pepper).update(rawApiKey).digest("base64url");
  }

  private async findApiKey(keyHash: string): Promise<VerifiedIngestionApiKey | null> {
    const cachedApiKey = await this.cache?.get(keyHash).catch(() => null);

    if (cachedApiKey !== undefined && cachedApiKey !== null) {
      return cachedApiKey;
    }

    const apiKey = await this.apiKeys.findActiveByHash(keyHash);

    if (apiKey !== null) {
      await this.cache?.set(keyHash, apiKey).catch(() => undefined);
    }

    return apiKey;
  }

  private assertScope(apiKey: VerifiedIngestionApiKey, requiredScope: string): void {
    if (!apiKey.scopes.includes(requiredScope)) {
      throw forbidden("API key scope is not allowed");
    }
  }
}
