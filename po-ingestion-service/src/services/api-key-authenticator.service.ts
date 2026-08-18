import { createHmac } from "node:crypto";
import { forbidden, unauthorized } from "@pulseops/shared";
import type {
  IngestionApiKeyRepository,
  VerifiedIngestionApiKey,
} from "../repositories/ingestion-api-key.repository.js";

export type ApiKeyContext = {
  readonly projectId: string;
  readonly ownerId: string;
  readonly scopes: string[];
};

export class ApiKeyAuthenticatorService {
  constructor(
    private readonly apiKeys: IngestionApiKeyRepository,
    private readonly pepper: string,
  ) {}

  async authenticate(rawApiKey: string, requiredScope: string): Promise<ApiKeyContext> {
    const apiKey = await this.apiKeys.findActiveByHash(this.hash(rawApiKey));

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

  private assertScope(apiKey: VerifiedIngestionApiKey, requiredScope: string): void {
    if (!apiKey.scopes.includes(requiredScope)) {
      throw forbidden("API key scope is not allowed");
    }
  }
}
