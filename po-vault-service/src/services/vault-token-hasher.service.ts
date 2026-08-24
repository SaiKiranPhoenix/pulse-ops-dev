import { createHmac, randomBytes } from "node:crypto";
import { VAULT_LIMITS } from "../config/constants.js";

export type GeneratedVaultToken = {
  readonly rawToken: string;
  readonly tokenPrefix: string;
  readonly tokenHash: string;
};

export class VaultTokenHasher {
  constructor(private readonly pepper: string) {}

  generate(): GeneratedVaultToken {
    const rawToken = `povt_${randomBytes(VAULT_LIMITS.rawTokenBytes).toString("base64url")}`;
    return {
      rawToken,
      tokenPrefix: rawToken.slice(0, VAULT_LIMITS.tokenPrefixLength),
      tokenHash: this.hash(rawToken),
    };
  }

  hash(rawToken: string): string {
    return createHmac("sha256", this.pepper).update(rawToken).digest("hex");
  }
}
