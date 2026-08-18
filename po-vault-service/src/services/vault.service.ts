import { conflict, notFound } from "@pulseops/shared";
import type {
  SafeVaultSecretRecord,
  VaultSecretRepository,
} from "../repositories/vault-secret.repository.js";
import type { SecretCryptoService } from "./secret-crypto.service.js";

export type CreateSecretInput = {
  readonly projectId: string;
  readonly environment: string;
  readonly key: string;
  readonly value: string;
};

export type SecretMetadataDto = {
  readonly id: string;
  readonly projectId: string;
  readonly environment: string;
  readonly key: string;
  readonly version: number;
  readonly status: SafeVaultSecretRecord["status"];
  readonly createdAt: string;
  readonly updatedAt: string;
};

export type RevealedSecretDto = SecretMetadataDto & {
  readonly value: string;
};

export class VaultService {
  constructor(
    private readonly secrets: VaultSecretRepository,
    private readonly crypto: SecretCryptoService,
  ) {}

  async create(input: CreateSecretInput): Promise<SecretMetadataDto> {
    const environment = normalizeEnvironment(input.environment);
    const key = normalizeKey(input.key);
    const existingSecret = await this.secrets.findActive(input.projectId, environment, key);

    if (existingSecret !== null) {
      throw conflict("Secret already exists");
    }

    const secret = await this.secrets.create({
      projectId: input.projectId,
      environment,
      key,
      encryptedValue: await this.crypto.encrypt(input.value),
    });

    return toMetadataDto(secret);
  }

  async list(projectId: string, environment?: string | undefined): Promise<SecretMetadataDto[]> {
    const secrets = await this.secrets.list(
      projectId,
      environment === undefined ? undefined : normalizeEnvironment(environment),
    );
    return secrets.map(toMetadataDto);
  }

  async reveal(projectId: string, environment: string, key: string): Promise<RevealedSecretDto> {
    const secret = await this.secrets.findActiveWithValue(
      projectId,
      normalizeEnvironment(environment),
      normalizeKey(key),
    );

    if (secret === null) {
      throw notFound("Secret not found");
    }

    return {
      ...toMetadataDto(secret),
      value: await this.crypto.decrypt(secret.encryptedValue),
    };
  }

  async update(input: CreateSecretInput): Promise<SecretMetadataDto> {
    const secret = await this.secrets.updateValue(
      input.projectId,
      normalizeEnvironment(input.environment),
      normalizeKey(input.key),
      await this.crypto.encrypt(input.value),
    );

    if (secret === null) {
      throw notFound("Secret not found");
    }

    return toMetadataDto(secret);
  }

  async delete(projectId: string, environment: string, key: string): Promise<SecretMetadataDto> {
    const secret = await this.secrets.softDelete(
      projectId,
      normalizeEnvironment(environment),
      normalizeKey(key),
    );

    if (secret === null) {
      throw notFound("Secret not found");
    }

    return toMetadataDto(secret);
  }
}

function normalizeEnvironment(environment: string): string {
  return environment.trim().toLowerCase();
}

function normalizeKey(key: string): string {
  return key.trim();
}

function toMetadataDto(secret: SafeVaultSecretRecord): SecretMetadataDto {
  return {
    id: secret.id,
    projectId: secret.projectId,
    environment: secret.environment,
    key: secret.key,
    version: secret.version,
    status: secret.status,
    createdAt: secret.createdAt.toISOString(),
    updatedAt: secret.updatedAt.toISOString(),
  };
}
