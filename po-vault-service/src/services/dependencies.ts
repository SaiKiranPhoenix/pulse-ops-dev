import { VaultController } from "../controllers/vault.controller.js";
import { loadEnv } from "../config/env.js";
import { MongoVaultSecretRepository } from "../repositories/vault-secret.repository.js";
import { AesGcmSecretCryptoService } from "./secret-crypto.service.js";
import { VaultService } from "./vault.service.js";

export type VaultServiceDependencies = {
  readonly vaultController: VaultController;
  readonly vaultService: VaultService;
};

export function createVaultServiceDependencies(): VaultServiceDependencies {
  const env = loadEnv();
  const vaultService = new VaultService(
    new MongoVaultSecretRepository(),
    new AesGcmSecretCryptoService(env.VAULT_MASTER_PASSWORD),
  );

  return {
    vaultController: new VaultController(vaultService),
    vaultService,
  };
}
