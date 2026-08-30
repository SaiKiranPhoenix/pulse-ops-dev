import { Router } from "express";
import type { VaultController } from "../controllers/vault.controller.js";
import { createAuthMiddleware } from "../middlewares/auth.middleware.js";
import { validateBody, validateParams, validateQuery } from "../middlewares/validate.middleware.js";
import { asyncHandler } from "../utils/async-handler.js";
import {
  createSecretBodySchema,
  createVaultTokenBodySchema,
  revealSecretBodySchema,
  secretParamsSchema,
  secretQuerySchema,
  tokenFetchParamsSchema,
  updateSecretBodySchema,
  vaultTokenParamsSchema,
} from "../validators/vault.validator.js";

export type RouteDependencies = {
  readonly vaultController: VaultController;
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

  router.use(createAuthMiddleware());

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

  return router;
}
