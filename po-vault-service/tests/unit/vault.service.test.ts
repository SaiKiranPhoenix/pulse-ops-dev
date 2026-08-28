import { describe, expect, it } from "vitest";
import type { VaultAuditEventMessage } from "@pulseops/shared";
import type { VaultAuditPublisher } from "../../src/events/publishers/vault-audit.publisher.js";
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

  async markUsed(tokenId: string, lastUsedAt: Date): Promise<void> {
    const token = this.tokens.find((item) => item.id === tokenId);

    if (token !== undefined) {
      token.lastUsedAt = lastUsedAt;
    }
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
): VaultService {
  return new VaultService(
    secrets,
    tokens,
    new PlainTextCryptoService(),
    new VaultTokenHasher("pepper-value"),
    audits,
  );
}

function createService(
  secrets = new InMemorySecretRepository(),
  audits?: VaultAuditPublisher,
): VaultService {
  return createServiceWithRepositories(secrets, new InMemoryTokenRepository(), audits);
}

function withoutValue(secret: VaultSecretWithEncryptedValueRecord): SafeVaultSecretRecord {
  const { encryptedValue: _encryptedValue, ...safeSecret } = secret;
  return safeSecret;
}

function withoutHash(token: VaultTokenWithHashRecord): SafeVaultTokenRecord {
  const { tokenHash: _tokenHash, ...safeToken } = token;
  return safeToken;
}
