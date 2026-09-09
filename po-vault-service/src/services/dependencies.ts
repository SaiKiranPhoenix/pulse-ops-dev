import { VaultController } from "../controllers/vault.controller.js";
import { VaultPolicyController } from "../controllers/vault-policy.controller.js";
import { VaultEngineController } from "../controllers/vault-engine.controller.js";
import { loadEnv } from "../config/env.js";
import { createVaultAuditPublisher } from "../events/publishers/vault-audit.publisher.js";
import { MongoVaultSecretRepository } from "../repositories/vault-secret.repository.js";
import { MongoVaultTokenRepository } from "../repositories/vault-token.repository.js";
import { MongoVaultAuthMethodRepository } from "../repositories/vault-auth-method.repository.js";
import { MongoVaultIdentityRepository } from "../repositories/vault-identity.repository.js";
import { MongoVaultLeaseRepository } from "../repositories/vault-lease.repository.js";
import { MongoVaultSecretConsumerRepository } from "../repositories/vault-secret-consumer.repository.js";
import { AesGcmSecretCryptoService } from "./secret-crypto.service.js";
import { VaultService } from "./vault.service.js";
import { VaultPolicyService } from "./vault-policy.service.js";
import { DynamicSecretService } from "./dynamic-secret.service.js";
import { TransitEngineService } from "./transit-engine.service.js";
import { VaultTokenHasher } from "./vault-token-hasher.service.js";

export type VaultServiceDependencies = {
  readonly vaultController: VaultController;
  readonly vaultPolicyController: VaultPolicyController;
  readonly vaultEngineController: VaultEngineController;
  readonly vaultService: VaultService;
  readonly vaultPolicyService: VaultPolicyService;
  close(): Promise<void>;
};

export function createVaultServiceDependencies(): VaultServiceDependencies {
  const env = loadEnv();
  const auditPublisher = createVaultAuditPublisher(env.RABBITMQ_URL);
  const vaultService = new VaultService(
    new MongoVaultSecretRepository(),
    new MongoVaultTokenRepository(),
    new AesGcmSecretCryptoService(env.VAULT_MASTER_PASSWORD),
    new VaultTokenHasher(env.VAULT_TOKEN_PEPPER),
    auditPublisher,
    new MongoVaultAuthMethodRepository(),
    new MongoVaultIdentityRepository(),
    new MongoVaultLeaseRepository(),
    new MongoVaultSecretConsumerRepository(),
  );
  const vaultPolicyService = new VaultPolicyService();
  const dynamicSecretService = new DynamicSecretService();
  const transitEngineService = new TransitEngineService();

  return {
    vaultController: new VaultController(vaultService),
    vaultPolicyController: new VaultPolicyController(vaultPolicyService),
    vaultEngineController: new VaultEngineController(dynamicSecretService, transitEngineService),
    vaultService,
    vaultPolicyService,
    async close(): Promise<void> {
      await auditPublisher.close();
    },
  };
}
