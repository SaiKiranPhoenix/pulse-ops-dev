import { randomBytes } from "node:crypto";
import {
  conflict,
  forbidden,
  notFound,
  rateLimited,
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
  SafeVaultSecretVersionRecord,
  VaultSecretRepository,
} from "../repositories/vault-secret.repository.js";
import type {
  SafeVaultTokenRecord,
  VaultTokenRepository,
  VaultTokenWithHashRecord,
} from "../repositories/vault-token.repository.js";
import type {
  SafeVaultAuthMethodRecord,
  VaultAuthMethodRepository,
  VaultAuthMethodWithSecretRecord,
} from "../repositories/vault-auth-method.repository.js";
import type {
  SafeVaultIdentityRecord,
  VaultIdentityRepository,
} from "../repositories/vault-identity.repository.js";
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
  readonly authMethod?: SafeVaultTokenRecord["authMethod"] | undefined;
  readonly identityAlias?: string | undefined;
  readonly parentTokenId?: string | null | undefined;
  readonly ttlSeconds?: number | undefined;
  readonly maxTtlSeconds?: number | undefined;
  readonly renewable?: boolean | undefined;
} & VaultAuditContext;

export type CreateVaultAuthMethodInput = {
  readonly projectId: string;
  readonly type: "service-account" | "approle";
  readonly name: string;
  readonly scopes?: string[] | undefined;
  readonly environments?: string[] | undefined;
  readonly ttlSeconds?: number | undefined;
  readonly maxTtlSeconds?: number | undefined;
  readonly renewable?: boolean | undefined;
} & VaultAuditContext;

export type VaultTokenDto = {
  readonly id: string;
  readonly projectId: string;
  readonly name: string;
  readonly tokenPrefix: string;
  readonly scopes: string[];
  readonly environments: string[];
  readonly authMethod: SafeVaultTokenRecord["authMethod"];
  readonly identityAlias: string;
  readonly parentTokenId: string | null;
  readonly ttlSeconds: number;
  readonly maxTtlSeconds: number;
  readonly renewable: boolean;
  readonly issuedAt: string;
  readonly renewedAt: string | null;
  readonly status: SafeVaultTokenRecord["status"];
  readonly lastUsedAt: string | null;
  readonly expiresAt: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
};

export type VaultTokenCacheDiagnosticsDto = {
  readonly projectId: string;
  readonly status: "disabled";
  readonly validationMode: "database";
  readonly cachedTokens: 0;
  readonly cacheKeyPrefix: null;
  readonly inspectedAt: string;
};

export type CreatedVaultTokenDto = {
  readonly token: VaultTokenDto;
  readonly rawToken: string;
};

export type VaultAuthMethodDto = {
  readonly id: string;
  readonly projectId: string;
  readonly type: SafeVaultAuthMethodRecord["type"];
  readonly name: string;
  readonly identityAlias: string;
  readonly roleId: string | null;
  readonly tokenScopes: string[];
  readonly tokenEnvironments: string[];
  readonly tokenTtlSeconds: number;
  readonly tokenMaxTtlSeconds: number;
  readonly renewable: boolean;
  readonly status: SafeVaultAuthMethodRecord["status"];
  readonly lastUsedAt: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
};

export type CreatedVaultAuthMethodDto = {
  readonly authMethod: VaultAuthMethodDto;
  readonly secretId: string | null;
  readonly rawToken: string | null;
};

export type VaultIdentityDto = {
  readonly id: string;
  readonly projectId: string;
  readonly alias: string;
  readonly type: SafeVaultIdentityRecord["type"];
  readonly displayName: string;
  readonly metadata: Record<string, string>;
  readonly createdAt: string;
  readonly updatedAt: string;
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
  readonly createdBy: string | null;
  readonly updatedBy: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
};

export type RevealedSecretDto = SecretMetadataDto & {
  readonly value: string;
};

export type SecretVersionDto = {
  readonly version: number;
  readonly status: SafeVaultSecretVersionRecord["status"];
  readonly actorId: string | null;
  readonly occurredAt: string;
};

type RateLimitBucket = {
  count: number;
  resetAt: number;
};

export class VaultService {
  private readonly accessBuckets = new Map<string, RateLimitBucket>();
  private readonly failedRevealBuckets = new Map<string, RateLimitBucket>();

  constructor(
    private readonly secrets: VaultSecretRepository,
    private readonly tokens: VaultTokenRepository,
    private readonly crypto: SecretCryptoService,
    private readonly tokenHasher: VaultTokenHasher,
    private readonly audits: VaultAuditPublisher = noopVaultAuditPublisher,
    private readonly authMethods?: VaultAuthMethodRepository,
    private readonly identities?: VaultIdentityRepository,
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
      actorId: input.actorId ?? null,
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
    const environment = normalizeEnvironment(input.environment);
    const key = normalizeKey(input.key);

    this.assertSecretAccessAllowed(
      `reveal:${input.actorId ?? "unknown"}:${input.projectId}:${environment}:${key}`,
    );

    const secret = await this.secrets.findActiveWithValue(input.projectId, environment, key);

    if (secret === null) {
      throw notFound("Secret not found");
    }

    const failedRevealBucketKey = `failed-reveal:${input.actorId ?? "unknown"}:${input.projectId}:${environment}:${key}`;
    this.assertFailedRevealNotBlocked(failedRevealBucketKey);

    if (!this.crypto.verifyVaultPassword(input.vaultPassword)) {
      this.recordFailedReveal(failedRevealBucketKey);
      await this.publishAudit("vault.secret.reveal", "failure", secret, {
        ...input,
        reason: "invalid vault password",
      });
      throw unauthorized("Invalid vault password");
    }

    this.failedRevealBuckets.delete(failedRevealBucketKey);
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
      input.actorId ?? null,
    );

    if (secret === null) {
      throw notFound("Secret not found");
    }

    await this.publishAudit("vault.secret.update", "success", secret, input);
    return toMetadataDto(secret);
  }

  async createToken(input: CreateVaultTokenInput): Promise<CreatedVaultTokenDto> {
    const generatedToken = this.tokenHasher.generate();
    const issuedAt = new Date();
    const ttlSeconds = normalizeTtl(input.ttlSeconds, VAULT_LIMITS.defaultTokenTtlSeconds);
    const maxTtlSeconds = normalizeTtl(input.maxTtlSeconds, VAULT_LIMITS.defaultTokenMaxTtlSeconds);
    const expiresAt = input.expiresAt ?? new Date(issuedAt.getTime() + ttlSeconds * 1000);
    const token = await this.tokens.create({
      projectId: input.projectId,
      name: input.name.trim(),
      tokenPrefix: generatedToken.tokenPrefix,
      tokenHash: generatedToken.tokenHash,
      scopes: normalizeTokenScopes(input.scopes),
      environments: normalizeTokenEnvironments(input.environments),
      authMethod: input.authMethod ?? "integration-token",
      identityAlias: input.identityAlias ?? `user:${input.actorId ?? "unknown"}`,
      parentTokenId: input.parentTokenId ?? null,
      ttlSeconds,
      maxTtlSeconds,
      renewable: input.renewable ?? true,
      issuedAt,
      renewedAt: null,
      expiresAt,
    });
    await this.identities?.upsert({
      projectId: token.projectId,
      alias: token.identityAlias,
      type: token.authMethod === "integration-token" ? "user" : token.authMethod,
      displayName: token.name,
      metadata: { authMethod: token.authMethod },
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

  async lookupToken(rawToken: string): Promise<VaultTokenDto> {
    const token = await this.findUsableToken(this.tokenHasher.hash(rawToken));
    await this.tokens.markUsed(token.id, new Date());
    return toTokenDto(token);
  }

  async renewToken(rawToken: string): Promise<VaultTokenDto> {
    const token = await this.findUsableToken(this.tokenHasher.hash(rawToken));

    if (!token.renewable) {
      throw forbidden("Vault token is not renewable");
    }

    const now = new Date();
    const maxExpiresAt = token.issuedAt.getTime() + token.maxTtlSeconds * 1000;
    const nextExpiresAt = new Date(Math.min(now.getTime() + token.ttlSeconds * 1000, maxExpiresAt));

    if (nextExpiresAt.getTime() <= now.getTime()) {
      throw forbidden("Vault token max TTL reached");
    }

    const renewed = await this.tokens.renew(token.id, nextExpiresAt, token.ttlSeconds, now);

    if (renewed === null) {
      throw unauthorized("Invalid vault token");
    }

    await this.publishTokenAudit("vault.token.renew", "success", renewed, {
      actorId: renewed.id,
      correlationId: "token-self",
    });
    return toTokenDto(renewed);
  }

  async revokeSelf(rawToken: string): Promise<VaultTokenDto> {
    const tokenHash = this.tokenHasher.hash(rawToken);
    const token = await this.tokens.revokeByHash(tokenHash);

    if (token === null) {
      throw unauthorized("Invalid vault token");
    }

    await this.publishTokenAudit("vault.token.revoke_self", "success", token, {
      actorId: token.id,
      correlationId: "token-self",
    });
    return toTokenDto(token);
  }

  tokenCacheDiagnostics(projectId: string, now: Date = new Date()): VaultTokenCacheDiagnosticsDto {
    return {
      projectId,
      status: "disabled",
      validationMode: "database",
      cachedTokens: 0,
      cacheKeyPrefix: null,
      inspectedAt: now.toISOString(),
    };
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

  async createAuthMethod(input: CreateVaultAuthMethodInput): Promise<CreatedVaultAuthMethodDto> {
    if (this.authMethods === undefined || this.identities === undefined) {
      throw forbidden("Vault auth method storage is unavailable");
    }

    const type = input.type;
    const roleId = type === "approle" ? createCredentialId("role") : null;
    const secretId = type === "approle" ? createCredentialId("secret") : null;
    const authMethod = await this.authMethods.create({
      projectId: input.projectId,
      type,
      name: input.name.trim(),
      identityAlias: `${type}:${normalizeIdentityName(input.name)}`,
      roleId,
      secretIdHash: secretId === null ? null : this.tokenHasher.hash(secretId),
      tokenScopes: normalizeTokenScopes(input.scopes),
      tokenEnvironments: normalizeTokenEnvironments(input.environments),
      tokenTtlSeconds: normalizeTtl(input.ttlSeconds, VAULT_LIMITS.defaultTokenTtlSeconds),
      tokenMaxTtlSeconds: normalizeTtl(input.maxTtlSeconds, VAULT_LIMITS.defaultTokenMaxTtlSeconds),
      renewable: input.renewable ?? true,
    });
    await this.identities.upsert({
      projectId: authMethod.projectId,
      alias: authMethod.identityAlias,
      type,
      displayName: authMethod.name,
      metadata: { authMethod: type },
    });
    await this.publishAuthMethodAudit("vault.auth_method.create", "success", authMethod, input);
    const serviceAccountToken =
      type === "service-account"
        ? await this.createToken({
            projectId: input.projectId,
            name: `${authMethod.name} service token`,
            scopes: authMethod.tokenScopes,
            environments: authMethod.tokenEnvironments,
            authMethod: "service-account",
            identityAlias: authMethod.identityAlias,
            parentTokenId: authMethod.id,
            ttlSeconds: authMethod.tokenTtlSeconds,
            maxTtlSeconds: authMethod.tokenMaxTtlSeconds,
            renewable: authMethod.renewable,
            actorId: authMethod.id,
            ...(input.correlationId === undefined ? {} : { correlationId: input.correlationId }),
          })
        : null;

    return {
      authMethod: toAuthMethodDto(authMethod),
      secretId,
      rawToken: serviceAccountToken?.rawToken ?? null,
    };
  }

  async listAuthMethods(projectId: string): Promise<VaultAuthMethodDto[]> {
    const authMethods = await this.authMethods?.list(projectId);
    return (authMethods ?? []).map(toAuthMethodDto);
  }

  async listIdentities(projectId: string): Promise<VaultIdentityDto[]> {
    const identities = await this.identities?.list(projectId);
    return (identities ?? []).map(toIdentityDto);
  }

  async disableAuthMethod(projectId: string, authMethodId: string): Promise<VaultAuthMethodDto> {
    const authMethod = await this.authMethods?.disable(projectId, authMethodId);

    if (authMethod === undefined || authMethod === null) {
      throw notFound("Vault auth method not found");
    }

    await this.publishAuthMethodAudit("vault.auth_method.disable", "success", authMethod, {});
    return toAuthMethodDto(authMethod);
  }

  async loginAppRole(input: {
    readonly projectId: string;
    readonly roleId: string;
    readonly secretId: string;
    readonly correlationId?: string;
  }): Promise<CreatedVaultTokenDto> {
    const authMethod = await this.findUsableAppRole(input.projectId, input.roleId);

    if (
      authMethod.secretIdHash === null ||
      this.tokenHasher.hash(input.secretId) !== authMethod.secretIdHash
    ) {
      await this.publishAuthMethodAudit("vault.auth_method.login", "failure", authMethod, {
        correlationId: input.correlationId ?? "unknown",
        reason: "invalid secret id",
      });
      throw unauthorized("Invalid AppRole credentials");
    }

    await this.authMethods?.markUsed(authMethod.id, new Date());
    await this.publishAuthMethodAudit("vault.auth_method.login", "success", authMethod, {
      correlationId: input.correlationId ?? "unknown",
    });
    return this.createToken({
      projectId: input.projectId,
      name: `${authMethod.name} session`,
      scopes: authMethod.tokenScopes,
      environments: authMethod.tokenEnvironments,
      authMethod: "approle",
      identityAlias: authMethod.identityAlias,
      parentTokenId: authMethod.id,
      ttlSeconds: authMethod.tokenTtlSeconds,
      maxTtlSeconds: authMethod.tokenMaxTtlSeconds,
      renewable: authMethod.renewable,
      actorId: authMethod.id,
      ...(input.correlationId === undefined ? {} : { correlationId: input.correlationId }),
    });
  }

  async fetchWithToken(input: {
    readonly rawToken: string;
    readonly environment: string;
    readonly key: string;
    readonly correlationId?: string;
  }): Promise<RevealedSecretDto> {
    const tokenHash = this.tokenHasher.hash(input.rawToken);
    this.assertSecretAccessAllowed(`token-auth:${tokenHash}`);
    const token = await this.findUsableToken(tokenHash);
    const environment = normalizeEnvironment(input.environment);
    const key = normalizeKey(input.key);
    this.assertSecretAccessAllowed(`token-fetch:${token.id}:${environment}:${key}`);

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

    const secret = await this.secrets.findActiveWithValue(token.projectId, environment, key);

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

  private async findUsableToken(tokenHash: string): Promise<VaultTokenWithHashRecord> {
    const token = await this.tokens.findActiveByHash(tokenHash);

    if (token === null) {
      throw unauthorized("Invalid vault token");
    }

    if (token.expiresAt !== null && token.expiresAt.getTime() <= Date.now()) {
      throw unauthorized("Vault token expired");
    }

    return token;
  }

  private async findUsableAppRole(
    projectId: string,
    roleId: string,
  ): Promise<VaultAuthMethodWithSecretRecord> {
    const authMethod = await this.authMethods?.findActiveAppRole(projectId, roleId);

    if (authMethod === undefined || authMethod === null) {
      throw unauthorized("Invalid AppRole credentials");
    }

    return authMethod;
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
      context.actorId ?? null,
    );

    if (secret === null) {
      throw notFound("Secret not found");
    }

    await this.publishAudit("vault.secret.delete", "success", secret, context);
    return toMetadataDto(secret);
  }

  async versions(projectId: string, environment: string, key: string): Promise<SecretVersionDto[]> {
    const versions = await this.secrets.listVersions(
      projectId,
      normalizeEnvironment(environment),
      normalizeKey(key),
    );

    if (versions === null) {
      throw notFound("Secret not found");
    }

    return versions.map(toVersionDto);
  }

  private assertSecretAccessAllowed(bucketKey: string): void {
    this.assertBucketAllowed(
      this.accessBuckets,
      bucketKey,
      VAULT_LIMITS.secretReadLimit,
      VAULT_LIMITS.secretReadWindowMs,
      "Vault secret read rate limit exceeded",
    );
  }

  private assertFailedRevealNotBlocked(bucketKey: string): void {
    const bucket = this.failedRevealBuckets.get(bucketKey);

    if (
      bucket !== undefined &&
      bucket.resetAt > Date.now() &&
      bucket.count >= VAULT_LIMITS.failedRevealLimit
    ) {
      throw rateLimited("Vault reveal failed-attempt limit exceeded", {
        limit: VAULT_LIMITS.failedRevealLimit,
        resetAt: new Date(bucket.resetAt).toISOString(),
      });
    }
  }

  private recordFailedReveal(bucketKey: string): void {
    this.assertBucketAllowed(
      this.failedRevealBuckets,
      bucketKey,
      VAULT_LIMITS.failedRevealLimit,
      VAULT_LIMITS.failedRevealWindowMs,
      "Vault reveal failed-attempt limit exceeded",
    );
  }

  private assertBucketAllowed(
    buckets: Map<string, RateLimitBucket>,
    bucketKey: string,
    limit: number,
    windowMs: number,
    message: string,
  ): void {
    const now = Date.now();
    const existingBucket = buckets.get(bucketKey);
    const resetAt = now + windowMs;
    const bucket =
      existingBucket === undefined || existingBucket.resetAt <= now
        ? { count: 0, resetAt }
        : existingBucket;

    bucket.count += 1;
    buckets.set(bucketKey, bucket);

    if (bucket.count > limit) {
      throw rateLimited(message, {
        limit,
        resetAt: new Date(bucket.resetAt).toISOString(),
      });
    }
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

  private async publishAuthMethodAudit(
    action: VaultAuditEventMessage["action"],
    result: VaultAuditEventMessage["result"],
    authMethod: SafeVaultAuthMethodRecord,
    context: VaultAuditContext & { readonly reason?: string | undefined },
  ): Promise<void> {
    try {
      await this.audits.publish({
        messageId: `${authMethod.id}:${action}:${Date.now()}`,
        schemaVersion: 1,
        projectId: authMethod.projectId,
        actorType: "service",
        actorId: authMethod.identityAlias,
        action,
        result,
        environment: null,
        secretKey: null,
        tokenPrefix: null,
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
    createdBy: secret.createdBy,
    updatedBy: secret.updatedBy,
    createdAt: secret.createdAt.toISOString(),
    updatedAt: secret.updatedAt.toISOString(),
  };
}

function toVersionDto(version: SafeVaultSecretVersionRecord): SecretVersionDto {
  return {
    version: version.version,
    status: version.status,
    actorId: version.actorId,
    occurredAt: version.occurredAt.toISOString(),
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
    authMethod: token.authMethod,
    identityAlias: token.identityAlias,
    parentTokenId: token.parentTokenId,
    ttlSeconds: token.ttlSeconds,
    maxTtlSeconds: token.maxTtlSeconds,
    renewable: token.renewable,
    issuedAt: token.issuedAt.toISOString(),
    renewedAt: token.renewedAt?.toISOString() ?? null,
    status: token.status,
    lastUsedAt: token.lastUsedAt?.toISOString() ?? null,
    expiresAt: token.expiresAt?.toISOString() ?? null,
    createdAt: token.createdAt.toISOString(),
    updatedAt: token.updatedAt.toISOString(),
  };
}

function toAuthMethodDto(authMethod: SafeVaultAuthMethodRecord): VaultAuthMethodDto {
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
    lastUsedAt: authMethod.lastUsedAt?.toISOString() ?? null,
    createdAt: authMethod.createdAt.toISOString(),
    updatedAt: authMethod.updatedAt.toISOString(),
  };
}

function toIdentityDto(identity: SafeVaultIdentityRecord): VaultIdentityDto {
  return {
    id: identity.id,
    projectId: identity.projectId,
    alias: identity.alias,
    type: identity.type,
    displayName: identity.displayName,
    metadata: { ...identity.metadata },
    createdAt: identity.createdAt.toISOString(),
    updatedAt: identity.updatedAt.toISOString(),
  };
}

function normalizeTtl(value: number | undefined, fallback: number): number {
  if (value === undefined || !Number.isFinite(value)) {
    return fallback;
  }

  return Math.max(60, Math.min(Math.floor(value), VAULT_LIMITS.absoluteTokenMaxTtlSeconds));
}

function normalizeIdentityName(name: string): string {
  const normalized = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  return normalized.length === 0 ? "unnamed" : normalized;
}

function createCredentialId(prefix: string): string {
  return `${prefix}_${randomBytes(18).toString("base64url")}`;
}
