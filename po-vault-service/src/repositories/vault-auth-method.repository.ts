import {
  VaultAuthMethodModel,
  type VaultAuthMethodDocument,
  type VaultAuthMethodRecord,
} from "../models/vault-auth-method.model.js";

export type CreateVaultAuthMethodInput = {
  readonly projectId: string;
  readonly type: VaultAuthMethodRecord["type"];
  readonly name: string;
  readonly identityAlias: string;
  readonly roleId: string | null;
  readonly secretIdHash: string | null;
  readonly tokenScopes: string[];
  readonly tokenEnvironments: string[];
  readonly tokenTtlSeconds: number;
  readonly tokenMaxTtlSeconds: number;
  readonly renewable: boolean;
};

export type SafeVaultAuthMethodRecord = Omit<VaultAuthMethodRecord, "secretIdHash"> & {
  readonly id: string;
};

export type VaultAuthMethodWithSecretRecord = SafeVaultAuthMethodRecord & {
  readonly secretIdHash: string | null;
};

export interface VaultAuthMethodRepository {
  create(input: CreateVaultAuthMethodInput): Promise<SafeVaultAuthMethodRecord>;
  list(projectId: string): Promise<SafeVaultAuthMethodRecord[]>;
  findActiveAppRole(
    projectId: string,
    roleId: string,
  ): Promise<VaultAuthMethodWithSecretRecord | null>;
  markUsed(authMethodId: string, lastUsedAt: Date): Promise<void>;
  disable(projectId: string, authMethodId: string): Promise<SafeVaultAuthMethodRecord | null>;
}

export class MongoVaultAuthMethodRepository implements VaultAuthMethodRepository {
  async create(input: CreateVaultAuthMethodInput): Promise<SafeVaultAuthMethodRecord> {
    const authMethod = await VaultAuthMethodModel.create(input);
    return toSafeVaultAuthMethodRecord(authMethod);
  }

  async list(projectId: string): Promise<SafeVaultAuthMethodRecord[]> {
    const authMethods = await VaultAuthMethodModel.find({ projectId })
      .sort({ createdAt: -1 })
      .exec();
    return authMethods.map(toSafeVaultAuthMethodRecord);
  }

  async findActiveAppRole(
    projectId: string,
    roleId: string,
  ): Promise<VaultAuthMethodWithSecretRecord | null> {
    const authMethod = await VaultAuthMethodModel.findOne({
      projectId,
      roleId,
      type: "approle",
      status: "active",
    })
      .select("+secretIdHash")
      .exec();
    return authMethod === null ? null : toVaultAuthMethodWithSecretRecord(authMethod);
  }

  async markUsed(authMethodId: string, lastUsedAt: Date): Promise<void> {
    await VaultAuthMethodModel.updateOne({ _id: authMethodId }, { $set: { lastUsedAt } }).exec();
  }

  async disable(
    projectId: string,
    authMethodId: string,
  ): Promise<SafeVaultAuthMethodRecord | null> {
    const authMethod = await VaultAuthMethodModel.findOneAndUpdate(
      { _id: authMethodId, projectId },
      { $set: { status: "disabled" } },
      { new: true },
    ).exec();
    return authMethod === null ? null : toSafeVaultAuthMethodRecord(authMethod);
  }
}

export function toSafeVaultAuthMethodRecord(
  authMethod: VaultAuthMethodDocument,
): SafeVaultAuthMethodRecord {
  return {
    id: authMethod.id,
    projectId: authMethod.projectId,
    type: authMethod.type,
    name: authMethod.name,
    identityAlias: authMethod.identityAlias,
    roleId: authMethod.roleId,
    tokenScopes: [...authMethod.tokenScopes],
    tokenEnvironments: [...authMethod.tokenEnvironments],
    tokenTtlSeconds: authMethod.tokenTtlSeconds,
    tokenMaxTtlSeconds: authMethod.tokenMaxTtlSeconds,
    renewable: authMethod.renewable,
    status: authMethod.status,
    lastUsedAt: authMethod.lastUsedAt,
    createdAt: authMethod.createdAt,
    updatedAt: authMethod.updatedAt,
  };
}

function toVaultAuthMethodWithSecretRecord(
  authMethod: VaultAuthMethodDocument,
): VaultAuthMethodWithSecretRecord {
  return {
    ...toSafeVaultAuthMethodRecord(authMethod),
    secretIdHash: authMethod.secretIdHash,
  };
}
