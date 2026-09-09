import {
  VaultSecretModel,
  type EncryptedSecretValue,
  type VaultSecretDocument,
  type VaultSecretRecord,
  type VaultSecretVersionRecord,
} from "../models/vault-secret.model.js";

export type CreateVaultSecretInput = {
  readonly projectId: string;
  readonly environment: string;
  readonly key: string;
  readonly encryptedValue: EncryptedSecretValue;
  readonly actorId: string | null;
};

export type SafeVaultSecretRecord = Omit<VaultSecretRecord, "encryptedValue"> & {
  readonly id: string;
};

export type SafeVaultSecretVersionRecord = VaultSecretVersionRecord;

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
  listActiveWithValues(
    projectId: string,
    environment: string,
  ): Promise<VaultSecretWithEncryptedValueRecord[]>;
  list(projectId: string, environment?: string | undefined): Promise<SafeVaultSecretRecord[]>;
  updateValue(
    projectId: string,
    environment: string,
    key: string,
    encryptedValue: EncryptedSecretValue,
    actorId: string | null,
  ): Promise<SafeVaultSecretRecord | null>;
  listVersions(
    projectId: string,
    environment: string,
    key: string,
  ): Promise<SafeVaultSecretVersionRecord[] | null>;
  softDelete(
    projectId: string,
    environment: string,
    key: string,
    actorId: string | null,
  ): Promise<SafeVaultSecretRecord | null>;
}

export class MongoVaultSecretRepository implements VaultSecretRepository {
  async create(input: CreateVaultSecretInput): Promise<SafeVaultSecretRecord> {
    const secret = await VaultSecretModel.create({
      projectId: input.projectId,
      environment: input.environment,
      key: input.key,
      encryptedValue: input.encryptedValue,
      createdBy: input.actorId,
      updatedBy: input.actorId,
    });
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

  async listActiveWithValues(
    projectId: string,
    environment: string,
  ): Promise<VaultSecretWithEncryptedValueRecord[]> {
    const secrets = await VaultSecretModel.find({
      projectId,
      environment,
      status: "active",
    })
      .select("+encryptedValue")
      .sort({ key: 1 })
      .exec();

    return secrets.map(toSecretWithValueRecord);
  }

  async updateValue(
    projectId: string,
    environment: string,
    key: string,
    encryptedValue: EncryptedSecretValue,
    actorId: string | null,
  ): Promise<SafeVaultSecretRecord | null> {
    const currentSecret = await VaultSecretModel.findOne({
      projectId,
      environment,
      key,
      status: "active",
    }).exec();

    if (currentSecret === null) {
      return null;
    }

    const secret = await VaultSecretModel.findOneAndUpdate(
      { projectId, environment, key, status: "active" },
      {
        $set: { encryptedValue, updatedBy: actorId },
        $inc: { version: 1 },
        $push: {
          versions: {
            version: currentSecret.version,
            status: "rotated",
            actorId: currentSecret.updatedBy,
            occurredAt: currentSecret.updatedAt,
          },
        },
      },
      { new: true },
    ).exec();

    return secret === null ? null : toSafeSecretRecord(secret);
  }

  async listVersions(
    projectId: string,
    environment: string,
    key: string,
  ): Promise<SafeVaultSecretVersionRecord[] | null> {
    const secret = await VaultSecretModel.findOne({ projectId, environment, key, status: "active" })
      .select("+versions")
      .exec();

    if (secret === null) {
      return null;
    }

    const currentVersion: SafeVaultSecretVersionRecord = {
      version: secret.version,
      status: secret.status === "deleted" ? "deleted" : "rotated",
      actorId: secret.updatedBy,
      occurredAt: secret.updatedAt,
    };

    return [...secret.versions, currentVersion].sort((left, right) => right.version - left.version);
  }

  async softDelete(
    projectId: string,
    environment: string,
    key: string,
    actorId: string | null,
  ): Promise<SafeVaultSecretRecord | null> {
    const currentSecret = await VaultSecretModel.findOne({
      projectId,
      environment,
      key,
      status: "active",
    }).exec();

    if (currentSecret === null) {
      return null;
    }

    const secret = await VaultSecretModel.findOneAndUpdate(
      { projectId, environment, key, status: "active" },
      {
        $set: { status: "deleted", updatedBy: actorId },
        $push: {
          versions: {
            version: currentSecret.version,
            status: "deleted",
            actorId,
            occurredAt: new Date(),
          },
        },
      },
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
    versions: secret.versions ?? [],
    version: secret.version,
    status: secret.status,
    createdBy: secret.createdBy,
    updatedBy: secret.updatedBy,
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
