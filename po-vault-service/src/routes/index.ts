import { Router } from "express";
import type { VaultController } from "../controllers/vault.controller.js";
import type { VaultPolicyController } from "../controllers/vault-policy.controller.js";
import type { VaultEngineController } from "../controllers/vault-engine.controller.js";
import { createAuthMiddleware } from "../middlewares/auth.middleware.js";
import { validateBody, validateParams, validateQuery } from "../middlewares/validate.middleware.js";
import { asyncHandler } from "../utils/async-handler.js";
import {
  appRoleLoginBodySchema,
  bundleFetchParamsSchema,
  createVaultAuthMethodBodySchema,
  createSecretBodySchema,
  createVaultTokenBodySchema,
  revealSecretBodySchema,
  secretParamsSchema,
  secretQuerySchema,
  tokenFetchParamsSchema,
  updateSecretBodySchema,
  vaultAuthMethodParamsSchema,
  vaultLeaseParamsSchema,
  vaultTokenParamsSchema,
} from "../validators/vault.validator.js";

export type RouteDependencies = {
  readonly vaultController: VaultController;
  readonly vaultPolicyController: VaultPolicyController;
  readonly vaultEngineController: VaultEngineController;
};

export function createRoutes(dependencies: RouteDependencies): Router {
  const router = Router();

  router.get("/health", (_request, response) => {
    response.status(200).json({ status: "ok" });
  });
  router.get(
    "/integrations/vault/secrets/:environment/:key",
    validateParams(tokenFetchParamsSchema),
    asyncHandler(dependencies.vaultController.fetchWithToken),
  );
  router.get(
    "/integrations/vault/env/:environment",
    validateParams(bundleFetchParamsSchema),
    asyncHandler(dependencies.vaultController.fetchEnvironmentBundleWithToken),
  );
  router.post(
    "/vault/auth/approle/login",
    validateBody(appRoleLoginBodySchema),
    asyncHandler(dependencies.vaultController.loginAppRole),
  );
  router.get("/vault/token/lookup-self", asyncHandler(dependencies.vaultController.lookupToken));
  router.post("/vault/token/renew-self", asyncHandler(dependencies.vaultController.renewToken));
  router.post("/vault/token/revoke-self", asyncHandler(dependencies.vaultController.revokeSelf));

  router.use(createAuthMiddleware());

  // --- KV SECRETS ---
  router.post(
    "/vault/secrets",
    validateBody(createSecretBodySchema),
    asyncHandler(dependencies.vaultController.create),
  );
  router.get(
    "/vault/secrets",
    validateQuery(secretQuerySchema),
    asyncHandler(dependencies.vaultController.list),
  );
  router.post(
    "/vault/secrets/:environment/:key/reveal",
    validateParams(secretParamsSchema),
    validateBody(revealSecretBodySchema),
    asyncHandler(dependencies.vaultController.reveal),
  );
  router.put(
    "/vault/secrets/:environment/:key",
    validateParams(secretParamsSchema),
    validateBody(updateSecretBodySchema),
    asyncHandler(dependencies.vaultController.update),
  );
  router.get(
    "/vault/secrets/:environment/:key/versions",
    validateParams(secretParamsSchema),
    validateQuery(secretQuerySchema),
    asyncHandler(dependencies.vaultController.versions),
  );
  router.delete(
    "/vault/secrets/:environment/:key",
    validateParams(secretParamsSchema),
    validateQuery(secretQuerySchema),
    asyncHandler(dependencies.vaultController.delete),
  );

  // --- KV v2 METADATA & VERSION LIFECYCLE ---
  router.patch(
    "/vault/secrets/:environment/:key/metadata",
    asyncHandler(dependencies.vaultEngineController.updateSecretMetadata),
  );
  router.post(
    "/vault/secrets/:environment/:key/versions/:version/soft-delete",
    asyncHandler(dependencies.vaultEngineController.softDeleteVersion),
  );
  router.post(
    "/vault/secrets/:environment/:key/versions/:version/undelete",
    asyncHandler(dependencies.vaultEngineController.undeleteVersion),
  );
  router.delete(
    "/vault/secrets/:environment/:key/versions/:version/destroy",
    asyncHandler(dependencies.vaultEngineController.destroyVersion),
  );

  // --- POLICIES & ACCESS MODEL ---
  router.get("/vault/policies", asyncHandler(dependencies.vaultPolicyController.list));
  router.post("/vault/policies", asyncHandler(dependencies.vaultPolicyController.create));
  router.get("/vault/policies/:policyId", asyncHandler(dependencies.vaultPolicyController.get));
  router.put("/vault/policies/:policyId", asyncHandler(dependencies.vaultPolicyController.update));
  router.delete(
    "/vault/policies/:policyId",
    asyncHandler(dependencies.vaultPolicyController.delete),
  );
  router.post(
    "/vault/policies/simulate",
    asyncHandler(dependencies.vaultPolicyController.simulate),
  );

  // --- DYNAMIC DATABASE SECRETS ENGINE ---
  router.post(
    "/vault/dynamic/database/creds",
    asyncHandler(dependencies.vaultEngineController.generateDynamicDb),
  );
  router.get(
    "/vault/dynamic/database/creds",
    asyncHandler(dependencies.vaultEngineController.listDynamicDb),
  );
  router.post(
    "/vault/dynamic/database/creds/:leaseId/renew",
    asyncHandler(dependencies.vaultEngineController.renewDynamicDb),
  );
  router.post(
    "/vault/dynamic/database/creds/:leaseId/revoke",
    asyncHandler(dependencies.vaultEngineController.revokeDynamicDb),
  );

  // --- TRANSIT ENCRYPTION ENGINE ---
  router.post(
    "/vault/transit/encrypt",
    asyncHandler(dependencies.vaultEngineController.transitEncrypt),
  );
  router.post(
    "/vault/transit/decrypt",
    asyncHandler(dependencies.vaultEngineController.transitDecrypt),
  );
  router.post(
    "/vault/transit/keys/:keyName/rotate",
    asyncHandler(dependencies.vaultEngineController.transitRotate),
  );

  // --- TOKENS ---
  router.post(
    "/vault/tokens",
    validateBody(createVaultTokenBodySchema),
    asyncHandler(dependencies.vaultController.createToken),
  );
  router.get(
    "/vault/tokens",
    validateQuery(secretQuerySchema),
    asyncHandler(dependencies.vaultController.listTokens),
  );
  router.get(
    "/vault/token-cache/diagnostics",
    validateQuery(secretQuerySchema),
    asyncHandler(dependencies.vaultController.tokenCacheDiagnostics),
  );
  router.post(
    "/vault/tokens/:tokenId/revoke",
    validateParams(vaultTokenParamsSchema),
    validateQuery(secretQuerySchema),
    asyncHandler(dependencies.vaultController.revokeToken),
  );
  // --- AUTH METHODS & IDENTITY ---
  router.post(
    "/vault/auth-methods",
    validateBody(createVaultAuthMethodBodySchema),
    asyncHandler(dependencies.vaultController.createAuthMethod),
  );
  router.get(
    "/vault/auth-methods",
    validateQuery(secretQuerySchema),
    asyncHandler(dependencies.vaultController.listAuthMethods),
  );
  router.post(
    "/vault/auth-methods/:authMethodId/disable",
    validateParams(vaultAuthMethodParamsSchema),
    validateQuery(secretQuerySchema),
    asyncHandler(dependencies.vaultController.disableAuthMethod),
  );
  router.get(
    "/vault/identities",
    validateQuery(secretQuerySchema),
    asyncHandler(dependencies.vaultController.listIdentities),
  );
  router.get(
    "/vault/leases",
    validateQuery(secretQuerySchema),
    asyncHandler(dependencies.vaultController.listLeases),
  );
  router.post(
    "/vault/leases/:leaseId/renew",
    validateParams(vaultLeaseParamsSchema),
    validateQuery(secretQuerySchema),
    asyncHandler(dependencies.vaultController.renewLease),
  );
  router.post(
    "/vault/leases/:leaseId/revoke",
    validateParams(vaultLeaseParamsSchema),
    validateQuery(secretQuerySchema),
    asyncHandler(dependencies.vaultController.revokeLease),
  );
  router.get(
    "/vault/secret-consumers",
    validateQuery(secretQuerySchema),
    asyncHandler(dependencies.vaultController.listSecretConsumers),
  );
  router.get(
    "/vault/rotation-schedule",
    validateQuery(secretQuerySchema),
    asyncHandler(dependencies.vaultController.listRotationSchedule),
  );

  return router;
}
