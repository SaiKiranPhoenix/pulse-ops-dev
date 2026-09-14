import {
  VaultIdentityModel,
  type VaultIdentityDocument,
  type VaultIdentityRecord,
} from "../models/vault-identity.model.js";

export type UpsertVaultIdentityInput = {
  readonly projectId: string;
  readonly alias: string;
  readonly type: VaultIdentityRecord["type"];
  readonly displayName: string;
  readonly metadata?: Record<string, string> | undefined;
};

export type SafeVaultIdentityRecord = VaultIdentityRecord & {
  readonly id: string;
};

export interface VaultIdentityRepository {
  upsert(input: UpsertVaultIdentityInput): Promise<SafeVaultIdentityRecord>;
  list(projectId: string): Promise<SafeVaultIdentityRecord[]>;
}

export class MongoVaultIdentityRepository implements VaultIdentityRepository {
  async upsert(input: UpsertVaultIdentityInput): Promise<SafeVaultIdentityRecord> {
    const identity = await VaultIdentityModel.findOneAndUpdate(
      { projectId: input.projectId, alias: input.alias },
      { $set: input },
      { new: true, upsert: true },
    ).exec();
    return toSafeVaultIdentityRecord(identity);
  }

  async list(projectId: string): Promise<SafeVaultIdentityRecord[]> {
    const identities = await VaultIdentityModel.find({ projectId })
      .sort({ type: 1, alias: 1 })
      .exec();
    return identities.map(toSafeVaultIdentityRecord);
  }
}

export function toSafeVaultIdentityRecord(
  identity: VaultIdentityDocument,
): SafeVaultIdentityRecord {
  return {
    id: identity.id,
    projectId: identity.projectId,
    alias: identity.alias,
    type: identity.type,
    displayName: identity.displayName,
    metadata:
      identity.metadata instanceof Map
        ? Object.fromEntries(identity.metadata)
        : { ...identity.metadata },
    createdAt: identity.createdAt,
    updatedAt: identity.updatedAt,
  };
}
