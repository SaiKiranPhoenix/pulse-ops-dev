import { conflict, notFound, type VaultAuditEventMessage } from "@pulseops/shared";
import {
  noopVaultAuditPublisher,
  type VaultAuditPublisher,
} from "../events/publishers/vault-audit.publisher.js";
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
  readonly actorId?: string;
  readonly correlationId?: string;
};

export type VaultAuditContext = {
  readonly actorId?: string;
  readonly correlationId?: string;
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
    private readonly audits: VaultAuditPublisher = noopVaultAuditPublisher,
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
    await this.publishAudit("vault.secret.create", "success", secret, input);

    return toMetadataDto(secret);
  }

  async list(projectId: string, environment?: string | undefined): Promise<SecretMetadataDto[]> {
    const secrets = await this.secrets.list(
      projectId,
      environment === undefined ? undefined : normalizeEnvironment(environment),
    );
    return secrets.map(toMetadataDto);
  }

  async reveal(
    projectId: string,
    environment: string,
    key: string,
    context: VaultAuditContext = {},
  ): Promise<RevealedSecretDto> {
    const secret = await this.secrets.findActiveWithValue(
      projectId,
      normalizeEnvironment(environment),
      normalizeKey(key),
    );

    if (secret === null) {
      throw notFound("Secret not found");
    }

    await this.publishAudit("vault.secret.reveal", "success", secret, context);
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

    await this.publishAudit("vault.secret.update", "success", secret, input);
    return toMetadataDto(secret);
  }

  async delete(
    projectId: string,
    environment: string,
    key: string,
    context: VaultAuditContext = {},
  ): Promise<SecretMetadataDto> {
    const secret = await this.secrets.softDelete(
      projectId,
      normalizeEnvironment(environment),
      normalizeKey(key),
    );

    if (secret === null) {
      throw notFound("Secret not found");
    }

    await this.publishAudit("vault.secret.delete", "success", secret, context);
    return toMetadataDto(secret);
  }

  private async publishAudit(
    action: VaultAuditEventMessage["action"],
    result: VaultAuditEventMessage["result"],
    secret: SafeVaultSecretRecord,
    context: VaultAuditContext,
  ): Promise<void> {
    try {
      await this.audits.publish({
        messageId: `${secret.id}:${action}:${secret.version}:${Date.now()}`,
        schemaVersion: 1,
        projectId: secret.projectId,
        actorType: "user",
        actorId: context.actorId ?? "unknown",
        action,
        result,
        environment: secret.environment,
        secretKey: secret.key,
        tokenPrefix: null,
        reason: null,
        correlationId: context.correlationId ?? "unknown",
        occurredAt: new Date().toISOString(),
      });
    } catch {
      // Vault writes must not expose or roll back secrets because the audit queue is unavailable.
    }
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
