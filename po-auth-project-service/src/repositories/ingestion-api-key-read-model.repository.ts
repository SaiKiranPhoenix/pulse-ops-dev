import {
  IngestionApiKeyReadModelModel,
  type IngestionApiKeyReadModelDocument,
  type IngestionApiKeyReadModelRecord,
} from "../models/ingestion-api-key-read-model.model.js";
import type { SafeApiKeyRecord } from "./api-key.repository.js";

export type SafeIngestionApiKeyReadModelRecord = {
  readonly projectId: string;
  readonly ownerId: string;
  readonly keyHash: string;
  readonly keyPrefix: string;
  readonly scopes: string[];
  readonly status: IngestionApiKeyReadModelRecord["status"];
  readonly expiresAt: Date | null;
  readonly updatedAt: Date;
};

export interface IngestionApiKeyReadModelRepository {
  sync(apiKey: SafeApiKeyRecord): Promise<SafeIngestionApiKeyReadModelRecord>;
}

export class MongoIngestionApiKeyReadModelRepository
  implements IngestionApiKeyReadModelRepository
{
  async sync(apiKey: SafeApiKeyRecord): Promise<SafeIngestionApiKeyReadModelRecord> {
    const readModel = await IngestionApiKeyReadModelModel.findOneAndUpdate(
      { keyHash: apiKey.keyHash },
      {
        $set: {
          projectId: apiKey.projectId,
          ownerId: apiKey.ownerId,
          keyPrefix: apiKey.keyPrefix,
          scopes: apiKey.scopes,
          status: apiKey.status,
          expiresAt: apiKey.expiresAt,
        },
        $setOnInsert: {
          keyHash: apiKey.keyHash,
        },
      },
      { new: true, upsert: true },
    )
      .select("+keyHash")
      .exec();

    return toSafeReadModelRecord(readModel);
  }
}

function toSafeReadModelRecord(
  readModel: IngestionApiKeyReadModelDocument,
): SafeIngestionApiKeyReadModelRecord {
  const record = readModel.toObject<IngestionApiKeyReadModelRecord>();

  return {
    projectId: record.projectId,
    ownerId: record.ownerId,
    keyHash: record.keyHash,
    keyPrefix: record.keyPrefix,
    scopes: [...record.scopes],
    status: record.status,
    expiresAt: record.expiresAt,
    updatedAt: record.updatedAt,
  };
}
