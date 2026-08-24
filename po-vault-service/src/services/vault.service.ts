import {
  conflict,
  forbidden,
  notFound,
  unauthorized,
  type VaultAuditEventMessage,
} from "@pulseops/shared";
import {
  noopVaultAuditPublisher,
  type VaultAuditPublisher,
} from "../events/publishers/vault-audit.publisher.js";
import { VAULT_LIMITS } from "../config/constants.js";
import type {
  SafeVaultSecretRecord,
  VaultSecretRepository,
} from "../repositories/vault-secret.repository.js";
import type {
  SafeVaultTokenRecord,
  VaultTokenRepository,
  VaultTokenWithHashRecord,
} from "../repositories/vault-token.repository.js";
import type { SecretCryptoService } from "./secret-crypto.service.js";
import type { VaultTokenHasher } from "./vault-token-hasher.service.js";

export type CreateSecretInput = {
  readonly projectId: string;
  readonly environment: string;
  readonly key: string;
  readonly value: string;
  readonly actorId?: string;
  readonly correlationId?: string;
};

export type RevealSecretInput = {
  readonly projectId: string;
  readonly environment: string;
  readonly key: string;
  readonly vaultPassword: string;
} & VaultAuditContext;

export type CreateVaultTokenInput = {
  readonly projectId: string;
  readonly name: string;
  readonly scopes?: string[] | undefined;
  readonly environments?: string[] | undefined;
  readonly expiresAt?: Date | null | undefined;
} & VaultAuditContext;

export type VaultTokenDto = {
  readonly id: string;
  readonly projectId: string;
  readonly name: string;
  readonly tokenPrefix: string;
  readonly scopes: string[];
  readonly environments: string[];
  readonly status: SafeVaultTokenRecord["status"];
  readonly lastUsedAt: string | null;
  readonly expiresAt: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
};

export type CreatedVaultTokenDto = {
  readonly token: VaultTokenDto;
  readonly rawToken: string;
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
    private readonly tokens: VaultTokenRepository,
    private readonly crypto: SecretCryptoService,
    private readonly tokenHasher: VaultTokenHasher,
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

  async reveal(input: RevealSecretInput): Promise<RevealedSecretDto> {
    const secret = await this.secrets.findActiveWithValue(
      input.projectId,
      normalizeEnvironment(input.environment),
      normalizeKey(input.key),
    );

    if (secret === null) {
      throw notFound("Secret not found");
    }

    if (!this.crypto.verifyVaultPassword(input.vaultPassword)) {
      await this.publishAudit("vault.secret.reveal", "failure", secret, {
        ...input,
        reason: "invalid vault password",
      });
      throw unauthorized("Invalid vault password");
    }

    await this.publishAudit("vault.secret.reveal", "success", secret, input);
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

  async createToken(input: CreateVaultTokenInput): Promise<CreatedVaultTokenDto> {
    const generatedToken = this.tokenHasher.generate();
    const token = await this.tokens.create({
      projectId: input.projectId,
      name: input.name.trim(),
      tokenPrefix: generatedToken.tokenPrefix,
      tokenHash: generatedToken.tokenHash,
      scopes: normalizeTokenScopes(input.scopes),
      environments: normalizeTokenEnvironments(input.environments),
      expiresAt: input.expiresAt ?? null,
    });
    await this.publishTokenAudit("vault.token.create", "success", token, input);

    return {
      token: toTokenDto(token),
      rawToken: generatedToken.rawToken,
    };
  }

  async listTokens(projectId: string): Promise<VaultTokenDto[]> {
    const tokens = await this.tokens.findByProject(projectId);
    return tokens.map(toTokenDto);
  }

  async revokeToken(
    projectId: string,
    tokenId: string,
    context: VaultAuditContext = {},
  ): Promise<VaultTokenDto> {
    const token = await this.tokens.revoke(projectId, tokenId);

    if (token === null) {
      throw notFound("Vault token not found");
    }

    await this.publishTokenAudit("vault.token.revoke", "success", token, context);
    return toTokenDto(token);
  }

  async fetchWithToken(input: {
    readonly rawToken: string;
    readonly environment: string;
    readonly key: string;
    readonly correlationId?: string;
  }): Promise<RevealedSecretDto> {
    const token = await this.findUsableToken(input.rawToken);
    const environment = normalizeEnvironment(input.environment);

    if (!token.scopes.includes("secrets:read")) {
      await this.publishTokenAudit("vault.integration.fetch", "failure", token, {
        actorId: token.id,
        correlationId: input.correlationId ?? "unknown",
        reason: "missing secrets:read scope",
      });
      throw forbidden("Vault token scope denied");
    }

    if (token.environments.length > 0 && !token.environments.includes(environment)) {
      await this.publishTokenAudit("vault.integration.fetch", "failure", token, {
        actorId: token.id,
        correlationId: input.correlationId ?? "unknown",
        reason: "environment denied",
      });
      throw forbidden("Vault token environment denied");
    }

    const secret = await this.secrets.findActiveWithValue(
      token.projectId,
      environment,
      normalizeKey(input.key),
    );

    if (secret === null) {
      await this.publishTokenAudit("vault.integration.fetch", "failure", token, {
        actorId: token.id,
        correlationId: input.correlationId ?? "unknown",
        reason: "secret not found",
      });
      throw notFound("Secret not found");
    }

    await this.tokens.markUsed(token.id, new Date());
    await this.publishTokenAudit("vault.integration.fetch", "success", token, {
      actorId: token.id,
      correlationId: input.correlationId ?? "unknown",
    });

    return {
      ...toMetadataDto(secret),
      value: await this.crypto.decrypt(secret.encryptedValue),
    };
  }

  private async findUsableToken(rawToken: string): Promise<VaultTokenWithHashRecord> {
    const token = await this.tokens.findActiveByHash(this.tokenHasher.hash(rawToken));

    if (token === null) {
      throw unauthorized("Invalid vault token");
    }

    if (token.expiresAt !== null && token.expiresAt.getTime() <= Date.now()) {
      throw unauthorized("Vault token expired");
    }

    return token;
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
    context: VaultAuditContext & { readonly reason?: string | undefined },
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
        reason: context.reason ?? null,
        correlationId: context.correlationId ?? "unknown",
        occurredAt: new Date().toISOString(),
      });
    } catch {
      // Vault writes must not expose or roll back secrets because the audit queue is unavailable.
    }
  }

  private async publishTokenAudit(
    action: VaultAuditEventMessage["action"],
    result: VaultAuditEventMessage["result"],
    token: SafeVaultTokenRecord,
    context: VaultAuditContext & { readonly reason?: string | undefined },
  ): Promise<void> {
    try {
      await this.audits.publish({
        messageId: `${token.id}:${action}:${Date.now()}`,
        schemaVersion: 1,
        projectId: token.projectId,
        actorType: action === "vault.integration.fetch" ? "integration" : "user",
        actorId: context.actorId ?? "unknown",
        action,
        result,
        environment: null,
        secretKey: null,
        tokenPrefix: token.tokenPrefix,
        reason: context.reason ?? null,
        correlationId: context.correlationId ?? "unknown",
        occurredAt: new Date().toISOString(),
      });
    } catch {
      // Audit publishing is best-effort for local MVP availability.
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

function normalizeTokenScopes(scopes: string[] | undefined): string[] {
  const selectedScopes =
    scopes === undefined || scopes.length === 0 ? [...VAULT_LIMITS.defaultTokenScopes] : scopes;
  return [...new Set(selectedScopes)].sort();
}

function normalizeTokenEnvironments(environments: string[] | undefined): string[] {
  return [...new Set((environments ?? []).map(normalizeEnvironment))].sort();
}

function toTokenDto(token: SafeVaultTokenRecord): VaultTokenDto {
  return {
    id: token.id,
    projectId: token.projectId,
    name: token.name,
    tokenPrefix: token.tokenPrefix,
    scopes: [...token.scopes],
    environments: [...token.environments],
    status: token.status,
    lastUsedAt: token.lastUsedAt?.toISOString() ?? null,
    expiresAt: token.expiresAt?.toISOString() ?? null,
    createdAt: token.createdAt.toISOString(),
    updatedAt: token.updatedAt.toISOString(),
  };
}
