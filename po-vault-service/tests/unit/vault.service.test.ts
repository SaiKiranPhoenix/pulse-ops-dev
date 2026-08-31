import { describe, expect, it } from "vitest";
import type { VaultAuditEventMessage } from "@pulseops/shared";
import type { VaultAuditPublisher } from "../../src/events/publishers/vault-audit.publisher.js";
import { VAULT_LIMITS } from "../../src/config/constants.js";
import type { EncryptedSecretValue } from "../../src/models/vault-secret.model.js";
import type {
  CreateVaultSecretInput,
  SafeVaultSecretRecord,
  SafeVaultSecretVersionRecord,
  VaultSecretRepository,
  VaultSecretWithEncryptedValueRecord,
} from "../../src/repositories/vault-secret.repository.js";
import type {
  CreateVaultTokenInput,
  SafeVaultTokenRecord,
  VaultTokenRepository,
  VaultTokenWithHashRecord,
} from "../../src/repositories/vault-token.repository.js";
import type {
  CreateVaultAuthMethodInput,
  SafeVaultAuthMethodRecord,
  VaultAuthMethodRepository,
  VaultAuthMethodWithSecretRecord,
} from "../../src/repositories/vault-auth-method.repository.js";
import type {
  SafeVaultIdentityRecord,
  UpsertVaultIdentityInput,
  VaultIdentityRepository,
} from "../../src/repositories/vault-identity.repository.js";
import type { SecretCryptoService } from "../../src/services/secret-crypto.service.js";
import { VaultService } from "../../src/services/vault.service.js";
import { VaultTokenHasher } from "../../src/services/vault-token-hasher.service.js";

class InMemorySecretRepository implements VaultSecretRepository {
  readonly secrets: VaultSecretWithEncryptedValueRecord[] = [];

  async create(input: CreateVaultSecretInput): Promise<SafeVaultSecretRecord> {
    const secret: VaultSecretWithEncryptedValueRecord = {
      id: `secret_${this.secrets.length + 1}`,
      projectId: input.projectId,
      environment: input.environment,
      key: input.key,
      encryptedValue: input.encryptedValue,
      versions: [],
      version: 1,
      status: "active",
      createdBy: input.actorId,
      updatedBy: input.actorId,
      createdAt: new Date("2026-08-18T00:00:00.000Z"),
      updatedAt: new Date("2026-08-18T00:00:00.000Z"),
    };
    this.secrets.push(secret);
    return withoutValue(secret);
  }

  async findActive(
    projectId: string,
    environment: string,
    key: string,
  ): Promise<SafeVaultSecretRecord | null> {
    const secret = await this.findActiveWithValue(projectId, environment, key);
    return secret === null ? null : withoutValue(secret);
  }

  async findActiveWithValue(
    projectId: string,
    environment: string,
    key: string,
  ): Promise<VaultSecretWithEncryptedValueRecord | null> {
    return (
      this.secrets.find(
        (secret) =>
          secret.projectId === projectId &&
          secret.environment === environment &&
          secret.key === key &&
          secret.status === "active",
      ) ?? null
    );
  }

  async list(): Promise<SafeVaultSecretRecord[]> {
    return this.secrets.map(withoutValue);
  }

  async updateValue(
    projectId: string,
    environment: string,
    key: string,
    encryptedValue: EncryptedSecretValue,
    actorId: string | null,
  ): Promise<SafeVaultSecretRecord | null> {
    const secret = await this.findActiveWithValue(projectId, environment, key);

    if (secret === null) {
      return null;
    }

    secret.versions.push({
      version: secret.version,
      status: "rotated",
      actorId: secret.updatedBy,
      occurredAt: secret.updatedAt,
    });
    secret.encryptedValue = encryptedValue;
    secret.version += 1;
    secret.updatedBy = actorId;
    secret.updatedAt = new Date("2026-08-18T00:01:00.000Z");
    return withoutValue(secret);
  }

  async listVersions(
    projectId: string,
    environment: string,
    key: string,
  ): Promise<SafeVaultSecretVersionRecord[] | null> {
    const secret = await this.findActiveWithValue(projectId, environment, key);

    if (secret === null) {
      return null;
    }

    return [
      ...secret.versions,
      {
        version: secret.version,
        status: secret.status === "deleted" ? "deleted" : "rotated",
        actorId: secret.updatedBy,
        occurredAt: secret.updatedAt,
      },
    ];
  }

  async softDelete(
    projectId: string,
    environment: string,
    key: string,
    actorId: string | null,
  ): Promise<SafeVaultSecretRecord | null> {
    const secret = await this.findActiveWithValue(projectId, environment, key);

    if (secret === null) {
      return null;
    }

    secret.versions.push({
      version: secret.version,
      status: "deleted",
      actorId,
      occurredAt: new Date("2026-08-18T00:02:00.000Z"),
    });
    secret.status = "deleted";
    secret.updatedBy = actorId;
    return withoutValue(secret);
  }
}

class InMemoryTokenRepository implements VaultTokenRepository {
  readonly tokens: VaultTokenWithHashRecord[] = [];

  async create(input: CreateVaultTokenInput): Promise<SafeVaultTokenRecord> {
    const token: VaultTokenWithHashRecord = {
      id: `token_${this.tokens.length + 1}`,
      projectId: input.projectId,
      name: input.name,
      tokenPrefix: input.tokenPrefix,
      tokenHash: input.tokenHash,
      scopes: input.scopes,
      environments: input.environments,
      authMethod: input.authMethod,
      identityAlias: input.identityAlias,
      parentTokenId: input.parentTokenId,
      ttlSeconds: input.ttlSeconds,
      maxTtlSeconds: input.maxTtlSeconds,
      renewable: input.renewable,
      issuedAt: input.issuedAt,
      renewedAt: input.renewedAt,
      status: "active",
      lastUsedAt: null,
      expiresAt: input.expiresAt,
      createdAt: new Date("2026-08-18T00:00:00.000Z"),
      updatedAt: new Date("2026-08-18T00:00:00.000Z"),
    };
    this.tokens.push(token);
    return withoutHash(token);
  }

  async findByProject(projectId: string): Promise<SafeVaultTokenRecord[]> {
    return this.tokens.filter((token) => token.projectId === projectId).map(withoutHash);
  }

  async findActiveByHash(tokenHash: string): Promise<VaultTokenWithHashRecord | null> {
    return (
      this.tokens.find((token) => token.tokenHash === tokenHash && token.status === "active") ??
      null
    );
  }

  async revoke(projectId: string, tokenId: string): Promise<SafeVaultTokenRecord | null> {
    const token = this.tokens.find((item) => item.projectId === projectId && item.id === tokenId);

    if (token === undefined) {
      return null;
    }

    token.status = "revoked";
    return withoutHash(token);
  }

  async revokeByHash(tokenHash: string): Promise<SafeVaultTokenRecord | null> {
    const token = this.tokens.find(
      (item) => item.tokenHash === tokenHash && item.status === "active",
    );

    if (token === undefined) {
      return null;
    }

    token.status = "revoked";
    return withoutHash(token);
  }

  async renew(
    tokenId: string,
    expiresAt: Date,
    ttlSeconds: number,
    renewedAt: Date,
  ): Promise<SafeVaultTokenRecord | null> {
    const token = this.tokens.find((item) => item.id === tokenId && item.status === "active");

    if (token === undefined) {
      return null;
    }

    token.expiresAt = expiresAt;
    token.ttlSeconds = ttlSeconds;
    token.renewedAt = renewedAt;
    return withoutHash(token);
  }

  async markUsed(tokenId: string, lastUsedAt: Date): Promise<void> {
    const token = this.tokens.find((item) => item.id === tokenId);

    if (token !== undefined) {
      token.lastUsedAt = lastUsedAt;
    }
  }
}

class InMemoryAuthMethodRepository implements VaultAuthMethodRepository {
  readonly authMethods: VaultAuthMethodWithSecretRecord[] = [];

  async create(input: CreateVaultAuthMethodInput): Promise<SafeVaultAuthMethodRecord> {
    const authMethod: VaultAuthMethodWithSecretRecord = {
      id: `auth_method_${this.authMethods.length + 1}`,
      projectId: input.projectId,
      type: input.type,
      name: input.name,
      identityAlias: input.identityAlias,
      roleId: input.roleId,
      secretIdHash: input.secretIdHash,
      tokenScopes: input.tokenScopes,
      tokenEnvironments: input.tokenEnvironments,
      tokenTtlSeconds: input.tokenTtlSeconds,
      tokenMaxTtlSeconds: input.tokenMaxTtlSeconds,
      renewable: input.renewable,
      status: "active",
      lastUsedAt: null,
      createdAt: new Date("2026-08-18T00:00:00.000Z"),
      updatedAt: new Date("2026-08-18T00:00:00.000Z"),
    };
    this.authMethods.push(authMethod);
    return withoutSecretIdHash(authMethod);
  }

  async list(projectId: string): Promise<SafeVaultAuthMethodRecord[]> {
    return this.authMethods
      .filter((authMethod) => authMethod.projectId === projectId)
      .map(withoutSecretIdHash);
  }

  async findActiveAppRole(
    projectId: string,
    roleId: string,
  ): Promise<VaultAuthMethodWithSecretRecord | null> {
    return (
      this.authMethods.find(
        (authMethod) =>
          authMethod.projectId === projectId &&
          authMethod.roleId === roleId &&
          authMethod.type === "approle" &&
          authMethod.status === "active",
      ) ?? null
    );
  }

  async markUsed(authMethodId: string, lastUsedAt: Date): Promise<void> {
    const authMethod = this.authMethods.find((item) => item.id === authMethodId);

    if (authMethod !== undefined) {
      authMethod.lastUsedAt = lastUsedAt;
    }
  }

  async disable(
    projectId: string,
    authMethodId: string,
  ): Promise<SafeVaultAuthMethodRecord | null> {
    const authMethod = this.authMethods.find(
      (item) => item.projectId === projectId && item.id === authMethodId,
    );

    if (authMethod === undefined) {
      return null;
    }

    authMethod.status = "disabled";
    return withoutSecretIdHash(authMethod);
  }
}

class InMemoryIdentityRepository implements VaultIdentityRepository {
  readonly identities = new Map<string, SafeVaultIdentityRecord>();

  async upsert(input: UpsertVaultIdentityInput): Promise<SafeVaultIdentityRecord> {
    const key = `${input.projectId}:${input.alias}`;
    const existing = this.identities.get(key);
    const identity: SafeVaultIdentityRecord = {
      id: existing?.id ?? `identity_${this.identities.size + 1}`,
      projectId: input.projectId,
      alias: input.alias,
      type: input.type,
      displayName: input.displayName,
      metadata: input.metadata ?? {},
      createdAt: existing?.createdAt ?? new Date("2026-08-18T00:00:00.000Z"),
      updatedAt: new Date("2026-08-18T00:00:00.000Z"),
    };
    this.identities.set(key, identity);
    return identity;
  }

  async list(projectId: string): Promise<SafeVaultIdentityRecord[]> {
    return [...this.identities.values()].filter((identity) => identity.projectId === projectId);
  }
}

class PlainTextCryptoService implements SecretCryptoService {
  async encrypt(value: string): Promise<EncryptedSecretValue> {
    return { ciphertext: `encrypted:${value}`, iv: "iv", tag: "tag", salt: "salt" };
  }

  async decrypt(value: EncryptedSecretValue): Promise<string> {
    return value.ciphertext.replace(/^encrypted:/, "");
  }

  verifyVaultPassword(value: string): boolean {
    return value === "correct-password";
  }
}

class CapturingAuditPublisher implements VaultAuditPublisher {
  readonly messages: VaultAuditEventMessage[] = [];

  async publish(message: VaultAuditEventMessage): Promise<void> {
    this.messages.push(message);
  }

  async close(): Promise<void> {}
}

describe("VaultService", () => {
  it("stores encrypted values without returning raw secret material in metadata", async () => {
    const secrets = new InMemorySecretRepository();
    const service = createService(secrets);

    const metadata = await service.create({
      projectId: "project_1",
      environment: "production",
      key: "DATABASE_URL",
      value: "postgres://raw-secret",
    });

    expect(metadata).not.toHaveProperty("value");
    expect(metadata.createdBy).toBeNull();
    expect(secrets.secrets[0]?.encryptedValue.ciphertext).toBe("encrypted:postgres://raw-secret");
    expect(secrets.secrets[0]?.encryptedValue.ciphertext).not.toBe("postgres://raw-secret");
  });

  it("tracks secret version metadata when a secret is rotated", async () => {
    const secrets = new InMemorySecretRepository();
    const service = createService(secrets);
    await service.create({
      projectId: "project_1",
      environment: "production",
      key: "DATABASE_URL",
      value: "postgres://v1",
      actorId: "user_1",
    });

    const rotated = await service.update({
      projectId: "project_1",
      environment: "production",
      key: "DATABASE_URL",
      value: "postgres://v2",
      actorId: "user_2",
    });
    const versions = await service.versions("project_1", "production", "DATABASE_URL");

    expect(rotated.version).toBe(2);
    expect(rotated.updatedBy).toBe("user_2");
    expect(versions).toEqual([
      {
        version: 1,
        status: "rotated",
        actorId: "user_1",
        occurredAt: "2026-08-18T00:00:00.000Z",
      },
      {
        version: 2,
        status: "rotated",
        actorId: "user_2",
        occurredAt: "2026-08-18T00:01:00.000Z",
      },
    ]);
  });

  it("requires the vault password before revealing a secret", async () => {
    const service = createService();
    await service.create({
      projectId: "project_1",
      environment: "production",
      key: "DATABASE_URL",
      value: "postgres://safe",
    });

    await expect(
      service.reveal({
        projectId: "project_1",
        environment: "production",
        key: "DATABASE_URL",
        vaultPassword: "wrong-password",
      }),
    ).rejects.toThrow("Invalid vault password");

    await expect(
      service.reveal({
        projectId: "project_1",
        environment: "production",
        key: "DATABASE_URL",
        vaultPassword: "correct-password",
      }),
    ).resolves.toMatchObject({ value: "postgres://safe" });
  });

  it("creates hashed integration tokens and fetches secrets without exposing the hash", async () => {
    const service = createService();
    await service.create({
      projectId: "project_1",
      environment: "production",
      key: "API_TOKEN",
      value: "secret-value",
    });
    const created = await service.createToken({
      projectId: "project_1",
      name: "production-reader",
      environments: ["production"],
    });

    expect(created.rawToken).toMatch(/^povt_/);
    expect(created.token).not.toHaveProperty("tokenHash");
    await expect(
      service.fetchWithToken({
        rawToken: created.rawToken,
        environment: "production",
        key: "API_TOKEN",
      }),
    ).resolves.toMatchObject({ value: "secret-value" });
  });

  it("keeps secret and token list responses free of sensitive material", async () => {
    const secrets = new InMemorySecretRepository();
    const tokens = new InMemoryTokenRepository();
    const service = createServiceWithRepositories(secrets, tokens);
    await service.create({
      projectId: "project_1",
      environment: "production",
      key: "API_TOKEN",
      value: "secret-value",
    });
    const created = await service.createToken({
      projectId: "project_1",
      name: "production-reader",
      environments: ["production"],
    });

    const listJson = JSON.stringify({
      secrets: await service.list("project_1"),
      versions: await service.versions("project_1", "production", "API_TOKEN"),
      tokens: await service.listTokens("project_1"),
    });
    const tokenHash = tokens.tokens[0]?.tokenHash;

    expect(tokenHash).toBeDefined();
    expect(listJson).not.toContain("secret-value");
    expect(listJson).not.toContain("encrypted:secret-value");
    if (tokenHash !== undefined) {
      expect(listJson).not.toContain(tokenHash);
    }
    expect(listJson).not.toContain(created.rawToken);
    expect(listJson).not.toContain("tokenHash");
    expect(listJson).not.toContain("rawToken");
  });

  it("rate limits repeated failed vault reveal attempts", async () => {
    const service = createService();
    await service.create({
      projectId: "project_1",
      environment: "production",
      key: "DATABASE_URL",
      value: "postgres://safe",
    });

    for (let attempt = 0; attempt < VAULT_LIMITS.failedRevealLimit; attempt += 1) {
      await expect(
        service.reveal({
          projectId: "project_1",
          environment: "production",
          key: "DATABASE_URL",
          vaultPassword: "wrong-password",
          actorId: "user_1",
        }),
      ).rejects.toThrow("Invalid vault password");
    }

    await expect(
      service.reveal({
        projectId: "project_1",
        environment: "production",
        key: "DATABASE_URL",
        vaultPassword: "correct-password",
        actorId: "user_1",
      }),
    ).rejects.toThrow("Vault reveal failed-attempt limit exceeded");
  });

  it("reports vault token cache diagnostics for the current validation mode", () => {
    const service = createService();

    expect(
      service.tokenCacheDiagnostics("project_1", new Date("2026-08-18T00:00:00.000Z")),
    ).toEqual({
      projectId: "project_1",
      status: "disabled",
      validationMode: "database",
      cachedTokens: 0,
      cacheKeyPrefix: null,
      inspectedAt: "2026-08-18T00:00:00.000Z",
    });
  });

  it("creates AppRole auth methods without exposing the stored secret hash", async () => {
    const authMethods = new InMemoryAuthMethodRepository();
    const identities = new InMemoryIdentityRepository();
    const service = createService(undefined, undefined, authMethods, identities);

    const created = await service.createAuthMethod({
      projectId: "project_1",
      type: "approle",
      name: "render-api",
      environments: ["production"],
      ttlSeconds: 300,
      maxTtlSeconds: 900,
    });

    expect(created.authMethod).toMatchObject({
      type: "approle",
      name: "render-api",
      identityAlias: "approle:render-api",
      tokenTtlSeconds: 300,
      tokenMaxTtlSeconds: 900,
      renewable: true,
    });
    expect(created.authMethod.roleId).toMatch(/^role_/);
    expect(created.secretId).toMatch(/^secret_/);
    expect(JSON.stringify(created)).not.toContain("secretIdHash");
    expect(authMethods.authMethods[0]?.secretIdHash).toBeDefined();
    expect(JSON.stringify(await service.listIdentities("project_1"))).toContain(
      "approle:render-api",
    );
  });

  it("creates service account auth methods with a one-time bootstrap token", async () => {
    const tokens = new InMemoryTokenRepository();
    const service = createServiceWithRepositories(
      new InMemorySecretRepository(),
      tokens,
      undefined,
      new InMemoryAuthMethodRepository(),
      new InMemoryIdentityRepository(),
    );

    const created = await service.createAuthMethod({
      projectId: "project_1",
      type: "service-account",
      name: "deploy-bot",
      environments: ["staging"],
    });

    expect(created.secretId).toBeNull();
    expect(created.rawToken).toMatch(/^povt_/);
    expect(tokens.tokens[0]).toMatchObject({
      authMethod: "service-account",
      identityAlias: "service-account:deploy-bot",
    });
  });

  it("logs in with AppRole credentials and issues a renewable child token", async () => {
    const authMethods = new InMemoryAuthMethodRepository();
    const identities = new InMemoryIdentityRepository();
    const tokens = new InMemoryTokenRepository();
    const service = createServiceWithRepositories(
      new InMemorySecretRepository(),
      tokens,
      undefined,
      authMethods,
      identities,
    );
    const authMethod = await service.createAuthMethod({
      projectId: "project_1",
      type: "approle",
      name: "worker",
      environments: ["production"],
    });

    const createdToken = await service.loginAppRole({
      projectId: "project_1",
      roleId: String(authMethod.authMethod.roleId),
      secretId: String(authMethod.secretId),
    });

    expect(createdToken.rawToken).toMatch(/^povt_/);
    expect(createdToken.token).toMatchObject({
      projectId: "project_1",
      authMethod: "approle",
      identityAlias: "approle:worker",
      renewable: true,
      status: "active",
    });
    expect(tokens.tokens[0]?.tokenHash).toBeDefined();
    expect(JSON.stringify(createdToken)).not.toContain(tokens.tokens[0]?.tokenHash ?? "missing");
  });

  it("rejects invalid AppRole secret IDs", async () => {
    const authMethods = new InMemoryAuthMethodRepository();
    const service = createService(
      undefined,
      undefined,
      authMethods,
      new InMemoryIdentityRepository(),
    );
    const authMethod = await service.createAuthMethod({
      projectId: "project_1",
      type: "approle",
      name: "bad-login",
    });

    await expect(
      service.loginAppRole({
        projectId: "project_1",
        roleId: String(authMethod.authMethod.roleId),
        secretId: "wrong-secret",
      }),
    ).rejects.toThrow("Invalid AppRole credentials");
  });

  it("looks up, renews, and self-revokes vault tokens", async () => {
    const service = createService();
    const created = await service.createToken({
      projectId: "project_1",
      name: "automation",
      ttlSeconds: 60,
      maxTtlSeconds: 600,
    });

    const lookedUp = await service.lookupToken(created.rawToken);
    const renewed = await service.renewToken(created.rawToken);
    const revoked = await service.revokeSelf(created.rawToken);

    expect(lookedUp).toMatchObject({ name: "automation", status: "active" });
    expect(renewed.renewedAt).not.toBeNull();
    expect(revoked.status).toBe("revoked");
    await expect(service.lookupToken(created.rawToken)).rejects.toThrow("Invalid vault token");
  });

  it("does not renew non-renewable tokens", async () => {
    const service = createService();
    const created = await service.createToken({
      projectId: "project_1",
      name: "short-lived",
      renewable: false,
    });

    await expect(service.renewToken(created.rawToken)).rejects.toThrow(
      "Vault token is not renewable",
    );
  });

  it("publishes sanitized audit events for failed reveals and token fetches", async () => {
    const audits = new CapturingAuditPublisher();
    const service = createService(undefined, audits);
    await service.create({
      projectId: "project_1",
      environment: "production",
      key: "API_TOKEN",
      value: "super-secret-value",
    });
    const created = await service.createToken({
      projectId: "project_1",
      name: "production-reader",
      environments: ["production"],
    });

    await expect(
      service.reveal({
        projectId: "project_1",
        environment: "production",
        key: "API_TOKEN",
        vaultPassword: "wrong-password",
      }),
    ).rejects.toThrow("Invalid vault password");
    await service.fetchWithToken({
      rawToken: created.rawToken,
      environment: "production",
      key: "API_TOKEN",
    });

    const auditJson = JSON.stringify(audits.messages);
    expect(auditJson).not.toContain("super-secret-value");
    expect(auditJson).not.toContain("wrong-password");
    expect(auditJson).not.toContain(created.rawToken);
    expect(auditJson).not.toContain("authorization");
    expect(audits.messages).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          action: "vault.secret.reveal",
          result: "failure",
          reason: "invalid vault password",
        }),
        expect.objectContaining({
          action: "vault.integration.fetch",
          result: "success",
          tokenPrefix: created.token.tokenPrefix,
        }),
      ]),
    );
  });
});

function createServiceWithRepositories(
  secrets: InMemorySecretRepository,
  tokens: InMemoryTokenRepository,
  audits?: VaultAuditPublisher,
  authMethods = new InMemoryAuthMethodRepository(),
  identities = new InMemoryIdentityRepository(),
): VaultService {
  return new VaultService(
    secrets,
    tokens,
    new PlainTextCryptoService(),
    new VaultTokenHasher("pepper-value"),
    audits,
    authMethods,
    identities,
  );
}

function createService(
  secrets = new InMemorySecretRepository(),
  audits?: VaultAuditPublisher,
  authMethods = new InMemoryAuthMethodRepository(),
  identities = new InMemoryIdentityRepository(),
): VaultService {
  return createServiceWithRepositories(
    secrets,
    new InMemoryTokenRepository(),
    audits,
    authMethods,
    identities,
  );
}

function withoutValue(secret: VaultSecretWithEncryptedValueRecord): SafeVaultSecretRecord {
  const { encryptedValue: _encryptedValue, ...safeSecret } = secret;
  return safeSecret;
}

function withoutHash(token: VaultTokenWithHashRecord): SafeVaultTokenRecord {
  const { tokenHash: _tokenHash, ...safeToken } = token;
  return safeToken;
}

function withoutSecretIdHash(
  authMethod: VaultAuthMethodWithSecretRecord,
): SafeVaultAuthMethodRecord {
  const { secretIdHash: _secretIdHash, ...safeAuthMethod } = authMethod;
  return safeAuthMethod;
}
