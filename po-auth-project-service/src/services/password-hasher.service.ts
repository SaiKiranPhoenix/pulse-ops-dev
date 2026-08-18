import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { PASSWORD_HASHING } from "../config/constants.js";

const algorithm = "scrypt";
const version = "v1";

export interface PasswordHasher {
  hash(password: string): Promise<string>;
  verify(password: string, storedHash: string): Promise<boolean>;
}

export class ScryptPasswordHasher implements PasswordHasher {
  async hash(password: string): Promise<string> {
    const salt = randomBytes(PASSWORD_HASHING.saltBytes);
    const derivedKey = await deriveKey(password, salt);

    return [
      algorithm,
      version,
      PASSWORD_HASHING.scrypt.cost,
      PASSWORD_HASHING.scrypt.blockSize,
      PASSWORD_HASHING.scrypt.parallelization,
      PASSWORD_HASHING.keyLength,
      salt.toString("base64url"),
      derivedKey.toString("base64url"),
    ].join("$");
  }

  async verify(password: string, storedHash: string): Promise<boolean> {
    const parsedHash = parsePasswordHash(storedHash);
    const derivedKey = await deriveKey(password, parsedHash.salt);

    return timingSafeEqual(derivedKey, parsedHash.digest);
  }
}

async function deriveKey(password: string, salt: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scryptCallback(
      password,
      salt,
      PASSWORD_HASHING.keyLength,
      {
        N: PASSWORD_HASHING.scrypt.cost,
        r: PASSWORD_HASHING.scrypt.blockSize,
        p: PASSWORD_HASHING.scrypt.parallelization,
        maxmem: PASSWORD_HASHING.scrypt.maxMemory,
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

function parsePasswordHash(storedHash: string): { readonly salt: Buffer; readonly digest: Buffer } {
  const [
    storedAlgorithm,
    storedVersion,
    cost,
    blockSize,
    parallelization,
    keyLength,
    salt,
    digest,
  ] = storedHash.split("$");

  const expectedHeader = [
    algorithm,
    version,
    String(PASSWORD_HASHING.scrypt.cost),
    String(PASSWORD_HASHING.scrypt.blockSize),
    String(PASSWORD_HASHING.scrypt.parallelization),
    String(PASSWORD_HASHING.keyLength),
  ];

  const actualHeader = [
    storedAlgorithm,
    storedVersion,
    cost,
    blockSize,
    parallelization,
    keyLength,
  ];

  if (
    actualHeader.join("$") !== expectedHeader.join("$") ||
    salt === undefined ||
    digest === undefined
  ) {
    throw new Error("Unsupported password hash format");
  }

  return {
    salt: Buffer.from(salt, "base64url"),
    digest: Buffer.from(digest, "base64url"),
  };
}
