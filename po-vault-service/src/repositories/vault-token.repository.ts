import {
  VaultTokenModel,
  type VaultTokenDocument,
  type VaultTokenRecord,
} from "../models/vault-token.model.js";

export type CreateVaultTokenInput = {
  readonly projectId: string;
  readonly name: string;
  readonly tokenPrefix: string;
  readonly tokenHash: string;
  readonly scopes: string[];
  readonly environments: string[];
  readonly expiresAt: Date | null;
};

export type SafeVaultTokenRecord = Omit<VaultTokenRecord, "tokenHash"> & {
  readonly id: string;
};

export type VaultTokenWithHashRecord = SafeVaultTokenRecord & {
  readonly tokenHash: string;
};

export interface VaultTokenRepository {
  create(input: CreateVaultTokenInput): Promise<SafeVaultTokenRecord>;
  findByProject(projectId: string): Promise<SafeVaultTokenRecord[]>;
  findActiveByHash(tokenHash: string): Promise<VaultTokenWithHashRecord | null>;
  revoke(projectId: string, tokenId: string): Promise<SafeVaultTokenRecord | null>;
  markUsed(tokenId: string, lastUsedAt: Date): Promise<void>;
}

export class MongoVaultTokenRepository implements VaultTokenRepository {
  async create(input: CreateVaultTokenInput): Promise<SafeVaultTokenRecord> {
    const token = await VaultTokenModel.create(input);
    return toSafeVaultTokenRecord(token);
  }

  async findByProject(projectId: string): Promise<SafeVaultTokenRecord[]> {
    const tokens = await VaultTokenModel.find({ projectId }).sort({ createdAt: -1 }).exec();
    return tokens.map(toSafeVaultTokenRecord);
  }

  async findActiveByHash(tokenHash: string): Promise<VaultTokenWithHashRecord | null> {
    const token = await VaultTokenModel.findOne({ tokenHash, status: "active" })
      .select("+tokenHash")
      .exec();
    return token === null ? null : toVaultTokenWithHashRecord(token);
  }

  async revoke(projectId: string, tokenId: string): Promise<SafeVaultTokenRecord | null> {
    const token = await VaultTokenModel.findOneAndUpdate(
      { _id: tokenId, projectId },
      { $set: { status: "revoked" } },
      { new: true },
    ).exec();
    return token === null ? null : toSafeVaultTokenRecord(token);
  }

  async markUsed(tokenId: string, lastUsedAt: Date): Promise<void> {
    await VaultTokenModel.updateOne({ _id: tokenId }, { $set: { lastUsedAt } }).exec();
  }
}

function toSafeVaultTokenRecord(token: VaultTokenDocument): SafeVaultTokenRecord {
  return {
    id: token.id,
    projectId: token.projectId,
    name: token.name,
    tokenPrefix: token.tokenPrefix,
    scopes: [...token.scopes],
    environments: [...token.environments],
    status: token.status,
    lastUsedAt: token.lastUsedAt,
    expiresAt: token.expiresAt,
    createdAt: token.createdAt,
    updatedAt: token.updatedAt,
  };
}

function toVaultTokenWithHashRecord(token: VaultTokenDocument): VaultTokenWithHashRecord {
  return {
    ...toSafeVaultTokenRecord(token),
    tokenHash: token.tokenHash,
  };
}
