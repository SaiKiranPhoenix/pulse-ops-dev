import {
  VaultSecretConsumerModel,
  type VaultSecretConsumerDocument,
  type VaultSecretConsumerRecord,
} from "../models/vault-secret-consumer.model.js";

export type RecordSecretConsumerInput = {
  readonly projectId: string;
  readonly environment: string;
  readonly secretKey: string;
  readonly tokenId: string;
  readonly tokenPrefix: string;
  readonly identityAlias: string;
  readonly lastFetchedAt: Date;
  readonly lastLeaseId: string | null;
};

export type SafeVaultSecretConsumerRecord = VaultSecretConsumerRecord & {
  readonly id: string;
};

export interface VaultSecretConsumerRepository {
  record(input: RecordSecretConsumerInput): Promise<SafeVaultSecretConsumerRecord>;
  list(projectId: string): Promise<SafeVaultSecretConsumerRecord[]>;
}

export class MongoVaultSecretConsumerRepository implements VaultSecretConsumerRepository {
  async record(input: RecordSecretConsumerInput): Promise<SafeVaultSecretConsumerRecord> {
    const consumer = await VaultSecretConsumerModel.findOneAndUpdate(
      {
        projectId: input.projectId,
        environment: input.environment,
        secretKey: input.secretKey,
        tokenId: input.tokenId,
      },
      {
        $set: {
          tokenPrefix: input.tokenPrefix,
          identityAlias: input.identityAlias,
          lastFetchedAt: input.lastFetchedAt,
          lastLeaseId: input.lastLeaseId,
        },
        $inc: { fetchCount: 1 },
        $setOnInsert: {
          projectId: input.projectId,
          environment: input.environment,
          secretKey: input.secretKey,
          tokenId: input.tokenId,
        },
      },
      { new: true, upsert: true },
    ).exec();
    return toSafeVaultSecretConsumerRecord(consumer);
  }

  async list(projectId: string): Promise<SafeVaultSecretConsumerRecord[]> {
    const consumers = await VaultSecretConsumerModel.find({ projectId })
      .sort({ lastFetchedAt: -1 })
      .limit(100)
      .exec();
    return consumers.map(toSafeVaultSecretConsumerRecord);
  }
}

function toSafeVaultSecretConsumerRecord(
  consumer: VaultSecretConsumerDocument,
): SafeVaultSecretConsumerRecord {
  return {
    id: consumer.id,
    projectId: consumer.projectId,
    environment: consumer.environment,
    secretKey: consumer.secretKey,
    tokenId: consumer.tokenId,
    tokenPrefix: consumer.tokenPrefix,
    identityAlias: consumer.identityAlias,
    fetchCount: consumer.fetchCount,
    lastFetchedAt: consumer.lastFetchedAt,
    lastLeaseId: consumer.lastLeaseId,
    createdAt: consumer.createdAt,
    updatedAt: consumer.updatedAt,
  };
}
