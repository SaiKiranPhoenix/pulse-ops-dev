import {
  VaultSecretModel,
  type EncryptedSecretValue,
  type VaultSecretDocument,
  type VaultSecretRecord,
} from "../models/vault-secret.model.js";

export type CreateVaultSecretInput = {
  readonly projectId: string;
  readonly environment: string;
  readonly key: string;
  readonly encryptedValue: EncryptedSecretValue;
};

export type SafeVaultSecretRecord = Omit<VaultSecretRecord, "encryptedValue"> & {
  readonly id: string;
};

export type VaultSecretWithEncryptedValueRecord = SafeVaultSecretRecord & {
  readonly encryptedValue: EncryptedSecretValue;
};

export interface VaultSecretRepository {
  create(input: CreateVaultSecretInput): Promise<SafeVaultSecretRecord>;
  findActive(
    projectId: string,
    environment: string,
    key: string,
  ): Promise<SafeVaultSecretRecord | null>;
  findActiveWithValue(
    projectId: string,
    environment: string,
    key: string,
  ): Promise<VaultSecretWithEncryptedValueRecord | null>;
  list(projectId: string, environment?: string | undefined): Promise<SafeVaultSecretRecord[]>;
  updateValue(
    projectId: string,
    environment: string,
    key: string,
    encryptedValue: EncryptedSecretValue,
  ): Promise<SafeVaultSecretRecord | null>;
  softDelete(
    projectId: string,
    environment: string,
    key: string,
  ): Promise<SafeVaultSecretRecord | null>;
}

export class MongoVaultSecretRepository implements VaultSecretRepository {
  async create(input: CreateVaultSecretInput): Promise<SafeVaultSecretRecord> {
    const secret = await VaultSecretModel.create(input);
    return toSafeSecretRecord(secret);
  }

  async findActive(
    projectId: string,
    environment: string,
    key: string,
  ): Promise<SafeVaultSecretRecord | null> {
    const secret = await VaultSecretModel.findOne({
      projectId,
      environment,
      key,
      status: "active",
    }).exec();

    return secret === null ? null : toSafeSecretRecord(secret);
  }

  async findActiveWithValue(
    projectId: string,
    environment: string,
    key: string,
  ): Promise<VaultSecretWithEncryptedValueRecord | null> {
    const secret = await VaultSecretModel.findOne({
      projectId,
      environment,
      key,
      status: "active",
    })
      .select("+encryptedValue")
      .exec();

    return secret === null ? null : toSecretWithValueRecord(secret);
  }

  async list(projectId: string, environment?: string): Promise<SafeVaultSecretRecord[]> {
    const secrets = await VaultSecretModel.find({
      projectId,
      status: "active",
      ...(environment === undefined ? {} : { environment }),
    })
      .sort({ environment: 1, key: 1 })
      .exec();

    return secrets.map(toSafeSecretRecord);
  }

  async updateValue(
    projectId: string,
    environment: string,
    key: string,
    encryptedValue: EncryptedSecretValue,
  ): Promise<SafeVaultSecretRecord | null> {
    const secret = await VaultSecretModel.findOneAndUpdate(
      { projectId, environment, key, status: "active" },
      { $set: { encryptedValue }, $inc: { version: 1 } },
      { new: true },
    ).exec();

    return secret === null ? null : toSafeSecretRecord(secret);
  }

  async softDelete(
    projectId: string,
    environment: string,
    key: string,
  ): Promise<SafeVaultSecretRecord | null> {
    const secret = await VaultSecretModel.findOneAndUpdate(
      { projectId, environment, key, status: "active" },
      { $set: { status: "deleted" } },
      { new: true },
    ).exec();

    return secret === null ? null : toSafeSecretRecord(secret);
  }
}

function toSafeSecretRecord(secret: VaultSecretDocument): SafeVaultSecretRecord {
  return {
    id: secret.id,
    projectId: secret.projectId,
    environment: secret.environment,
    key: secret.key,
    version: secret.version,
    status: secret.status,
    createdAt: secret.createdAt,
    updatedAt: secret.updatedAt,
  };
}

function toSecretWithValueRecord(secret: VaultSecretDocument): VaultSecretWithEncryptedValueRecord {
  return {
    ...toSafeSecretRecord(secret),
    encryptedValue: secret.encryptedValue,
  };
}
