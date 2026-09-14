import { IngestionApiKeyModel } from "../models/ingestion-api-key.model.js";

export type VerifiedIngestionApiKey = {
  readonly projectId: string;
  readonly ownerId: string;
  readonly scopes: string[];
  readonly status: "active" | "disabled";
  readonly expiresAt: Date | null;
};

export interface IngestionApiKeyRepository {
  findActiveByHash(keyHash: string): Promise<VerifiedIngestionApiKey | null>;
}

export class MongoIngestionApiKeyRepository implements IngestionApiKeyRepository {
  async findActiveByHash(keyHash: string): Promise<VerifiedIngestionApiKey | null> {
    const apiKey = await IngestionApiKeyModel.findOne({ keyHash, status: "active" })
      .select("+keyHash")
      .exec();

    if (apiKey === null) {
      return null;
    }

    return {
      projectId: apiKey.projectId,
      ownerId: apiKey.ownerId,
      scopes: [...apiKey.scopes],
      status: apiKey.status,
      expiresAt: apiKey.expiresAt,
    };
  }
}
