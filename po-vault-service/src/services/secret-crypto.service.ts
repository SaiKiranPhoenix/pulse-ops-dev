import {
  createCipheriv,
  createDecipheriv,
  timingSafeEqual,
  randomBytes,
  scrypt as scryptCallback,
} from "node:crypto";
import { VAULT_CRYPTO } from "../config/constants.js";
import type { EncryptedSecretValue } from "../models/vault-secret.model.js";

export interface SecretCryptoService {
  encrypt(value: string): Promise<EncryptedSecretValue>;
  decrypt(value: EncryptedSecretValue): Promise<string>;
  verifyVaultPassword(value: string): boolean;
}

export class AesGcmSecretCryptoService implements SecretCryptoService {
  constructor(private readonly masterPassword: string) {}

  verifyVaultPassword(value: string): boolean {
    const left = Buffer.from(value);
    const right = Buffer.from(this.masterPassword);
    return left.length === right.length && timingSafeEqual(left, right);
  }

  async encrypt(value: string): Promise<EncryptedSecretValue> {
    const salt = randomBytes(VAULT_CRYPTO.saltLength);
    const iv = randomBytes(VAULT_CRYPTO.ivLength);
    const key = await this.deriveKey(salt);
    const cipher = createCipheriv(VAULT_CRYPTO.algorithm, key, iv, {
      authTagLength: VAULT_CRYPTO.tagLength,
    });
    const ciphertext = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
    const tag = cipher.getAuthTag();

    return {
      ciphertext: ciphertext.toString("base64url"),
      iv: iv.toString("base64url"),
      tag: tag.toString("base64url"),
      salt: salt.toString("base64url"),
    };
  }

  async decrypt(value: EncryptedSecretValue): Promise<string> {
    const salt = Buffer.from(value.salt, "base64url");
    const iv = Buffer.from(value.iv, "base64url");
    const key = await this.deriveKey(salt);
    const decipher = createDecipheriv(VAULT_CRYPTO.algorithm, key, iv, {
      authTagLength: VAULT_CRYPTO.tagLength,
    });

    decipher.setAuthTag(Buffer.from(value.tag, "base64url"));

    return Buffer.concat([
      decipher.update(Buffer.from(value.ciphertext, "base64url")),
      decipher.final(),
    ]).toString("utf8");
  }

  private async deriveKey(salt: Buffer): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      scryptCallback(
        this.masterPassword,
        salt,
        VAULT_CRYPTO.keyLength,
        {
          N: VAULT_CRYPTO.scryptCost,
          r: VAULT_CRYPTO.scryptBlockSize,
          p: VAULT_CRYPTO.scryptParallelization,
          maxmem: VAULT_CRYPTO.scryptMaxMemory,
        },
        (error, derivedKey) => {
          if (error !== null) {
            reject(error);
            return;
          }

          resolve(derivedKey);
        },
      );
    });
  }
}
