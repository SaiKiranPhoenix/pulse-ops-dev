import { ApiKeyModel, type ApiKeyDocument, type ApiKeyRecord } from "../models/api-key.model.js";

export type CreateApiKeyRecordInput = {
  readonly ownerId: string;
  readonly projectId: string;
  readonly name: string;
  readonly keyPrefix: string;
  readonly keyHash: string;
  readonly scopes: string[];
  readonly expiresAt: Date | null;
};

export type SafeApiKeyRecord = {
  readonly id: string;
  readonly ownerId: string;
  readonly projectId: string;
  readonly name: string;
  readonly keyPrefix: string;
  readonly keyHash: string;
  readonly scopes: string[];
  readonly status: ApiKeyRecord["status"];
  readonly lastUsedAt: Date | null;
  readonly expiresAt: Date | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
};

export interface ApiKeyRepository {
  create(input: CreateApiKeyRecordInput): Promise<SafeApiKeyRecord>;
  findByIdForProject(apiKeyId: string, projectId: string): Promise<SafeApiKeyRecord | null>;
  findByProject(projectId: string): Promise<SafeApiKeyRecord[]>;
  disable(apiKeyId: string, projectId: string): Promise<SafeApiKeyRecord | null>;
}

export class MongoApiKeyRepository implements ApiKeyRepository {
  async create(input: CreateApiKeyRecordInput): Promise<SafeApiKeyRecord> {
    const apiKey = await ApiKeyModel.create(input);
    return toSafeApiKeyRecord(apiKey);
  }

  async findByIdForProject(apiKeyId: string, projectId: string): Promise<SafeApiKeyRecord | null> {
    const apiKey = await ApiKeyModel.findOne({ _id: apiKeyId, projectId })
      .select("+keyHash")
      .exec();
    return apiKey === null ? null : toSafeApiKeyRecord(apiKey);
  }

  async findByProject(projectId: string): Promise<SafeApiKeyRecord[]> {
    const apiKeys = await ApiKeyModel.find({ projectId })
      .select("+keyHash")
      .sort({ createdAt: -1 })
      .exec();
    return apiKeys.map(toSafeApiKeyRecord);
  }

  async disable(apiKeyId: string, projectId: string): Promise<SafeApiKeyRecord | null> {
    const apiKey = await ApiKeyModel.findOneAndUpdate(
      { _id: apiKeyId, projectId },
      { $set: { status: "disabled" } },
      { new: true },
    )
      .select("+keyHash")
      .exec();

    return apiKey === null ? null : toSafeApiKeyRecord(apiKey);
  }
}

export function toSafeApiKeyRecord(apiKey: ApiKeyDocument): SafeApiKeyRecord {
  return {
    id: apiKey.id,
    ownerId: apiKey.ownerId,
    projectId: apiKey.projectId,
    name: apiKey.name,
    keyPrefix: apiKey.keyPrefix,
    keyHash: apiKey.keyHash,
    scopes: [...apiKey.scopes],
    status: apiKey.status,
    lastUsedAt: apiKey.lastUsedAt,
    expiresAt: apiKey.expiresAt,
    createdAt: apiKey.createdAt,
    updatedAt: apiKey.updatedAt,
  };
}
