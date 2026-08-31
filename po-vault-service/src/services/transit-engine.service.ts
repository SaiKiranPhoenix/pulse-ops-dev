import crypto from "node:crypto";
import type { TransitDecryptionResult, TransitEncryptionResult } from "@pulseops/shared/types";

interface TransitKeyRing {
  keyName: string;
  projectId: string;
  currentVersion: number;
  keys: Array<{ version: number; keyBytes: Buffer; createdAt: string }>;
}

export class TransitEngineService {
  private readonly keyrings: Map<string, TransitKeyRing> = new Map();

  private getKeyRing(projectId: string, keyName: string): TransitKeyRing {
    const mapKey = `${projectId}::${keyName}`;
    let ring = this.keyrings.get(mapKey);
    if (!ring) {
      ring = {
        keyName,
        projectId,
        currentVersion: 1,
        keys: [
          {
            version: 1,
            keyBytes: crypto.randomBytes(32),
            createdAt: new Date().toISOString(),
          },
        ],
      };
      this.keyrings.set(mapKey, ring);
    }
    return ring;
  }

  public async encrypt(
    projectId: string,
    keyName: string,
    plaintext: string,
  ): Promise<TransitEncryptionResult> {
    const ring = this.getKeyRing(projectId, keyName);
    const activeKey = ring.keys.find((k) => k.version === ring.currentVersion);
    if (!activeKey) {
      throw new Error(`Key version ${ring.currentVersion} not found for transit key ${keyName}`);
    }

    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv("aes-256-gcm", activeKey.keyBytes, iv);
    const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
    const tag = cipher.getAuthTag();

    const payload = `${iv.toString("base64")}:${tag.toString("base64")}:${encrypted.toString("base64")}`;
    const ciphertext = `vault:v${ring.currentVersion}:${Buffer.from(payload).toString("base64")}`;

    return {
      keyName,
      ciphertext,
      keyVersion: ring.currentVersion,
    };
  }

  public async decrypt(
    projectId: string,
    keyName: string,
    ciphertext: string,
  ): Promise<TransitDecryptionResult> {
    const ring = this.getKeyRing(projectId, keyName);
    const match = ciphertext.match(/^vault:v(\d+):(.+)$/);
    if (!match || !match[1] || !match[2]) {
      throw new Error("Invalid transit ciphertext format. Expected 'vault:v<version>:<base64>'");
    }

    const version = Number(match[1]);
    const key = ring.keys.find((k) => k.version === version);
    if (!key) {
      throw new Error(`Transit key version ${version} not available for key ${keyName}`);
    }

    const rawPayload = Buffer.from(match[2], "base64").toString("utf8");
    const [ivB64, tagB64, encB64] = rawPayload.split(":");
    if (!ivB64 || !tagB64 || !encB64) {
      throw new Error("Malformed transit ciphertext payload.");
    }

    const iv = Buffer.from(ivB64, "base64");
    const tag = Buffer.from(tagB64, "base64");
    const encrypted = Buffer.from(encB64, "base64");

    const decipher = crypto.createDecipheriv("aes-256-gcm", key.keyBytes, iv);
    decipher.setAuthTag(tag);
    const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);

    return {
      keyName,
      plaintext: decrypted.toString("utf8"),
    };
  }

  public async rotateKey(
    projectId: string,
    keyName: string,
  ): Promise<{ keyName: string; newVersion: number }> {
    const ring = this.getKeyRing(projectId, keyName);
    const newVersion = ring.currentVersion + 1;
    ring.keys.push({
      version: newVersion,
      keyBytes: crypto.randomBytes(32),
      createdAt: new Date().toISOString(),
    });
    ring.currentVersion = newVersion;
    return { keyName, newVersion };
  }
}
