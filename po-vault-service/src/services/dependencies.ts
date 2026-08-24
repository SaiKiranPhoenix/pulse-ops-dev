import { VaultController } from "../controllers/vault.controller.js";
import { loadEnv } from "../config/env.js";
import { createVaultAuditPublisher } from "../events/publishers/vault-audit.publisher.js";
import { MongoVaultSecretRepository } from "../repositories/vault-secret.repository.js";
import { AesGcmSecretCryptoService } from "./secret-crypto.service.js";
import { VaultService } from "./vault.service.js";

export type VaultServiceDependencies = {
  readonly vaultController: VaultController;
  readonly vaultService: VaultService;
  close(): Promise<void>;
};

export function createVaultServiceDependencies(): VaultServiceDependencies {
  const env = loadEnv();
  const auditPublisher = createVaultAuditPublisher(env.RABBITMQ_URL);
  const vaultService = new VaultService(
    new MongoVaultSecretRepository(),
    new AesGcmSecretCryptoService(env.VAULT_MASTER_PASSWORD),
    auditPublisher,
  );

  return {
    vaultController: new VaultController(vaultService),
    vaultService,
    async close(): Promise<void> {
      await auditPublisher.close();
    },
  };
}
