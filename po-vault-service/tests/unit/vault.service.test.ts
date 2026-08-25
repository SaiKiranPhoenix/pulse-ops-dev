import { describe, expect, it } from "vitest";
import type { EncryptedSecretValue } from "../../src/models/vault-secret.model.js";
import type {
  CreateVaultSecretInput,
  SafeVaultSecretRecord,
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
      version: 1,
      status: "active",
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
  ): Promise<SafeVaultSecretRecord | null> {
    const secret = await this.findActiveWithValue(projectId, environment, key);

    if (secret === null) {
      return null;
    }

    secret.encryptedValue = encryptedValue;
    secret.version += 1;
    return withoutValue(secret);
  }

  async softDelete(
    projectId: string,
    environment: string,
    key: string,
  ): Promise<SafeVaultSecretRecord | null> {
    const secret = await this.findActiveWithValue(projectId, environment, key);

    if (secret === null) {
      return null;
    }

    secret.status = "deleted";
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
    return { ciphertext: value, iv: "iv", tag: "tag", salt: "salt" };
  }

  async decrypt(value: EncryptedSecretValue): Promise<string> {
    return value.ciphertext;
  }

  verifyVaultPassword(value: string): boolean {
    return value === "correct-password";
  }
}

describe("VaultService", () => {
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
});

function createService(): VaultService {
  return new VaultService(
    new InMemorySecretRepository(),
    new InMemoryTokenRepository(),
    new PlainTextCryptoService(),
    new VaultTokenHasher("pepper-value"),
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
