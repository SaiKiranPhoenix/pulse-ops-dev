import { Router } from "express";
import type { VaultController } from "../controllers/vault.controller.js";
import { validateBody, validateParams, validateQuery } from "../middlewares/validate.middleware.js";
import { asyncHandler } from "../utils/async-handler.js";
import {
  createSecretBodySchema,
  secretParamsSchema,
  secretQuerySchema,
  updateSecretBodySchema,
} from "../validators/vault.validator.js";

export type RouteDependencies = {
  readonly vaultController: VaultController;
};

export function createRoutes(dependencies: RouteDependencies): Router {
  const router = Router();

  router.get("/health", (_request, response) => {
    response.status(200).json({ status: "ok" });
  });
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
  router.get(
    "/vault/secrets/:environment/:key/reveal",
    validateParams(secretParamsSchema),
    validateQuery(secretQuerySchema),
    asyncHandler(dependencies.vaultController.reveal),
  );
  router.put(
    "/vault/secrets/:environment/:key",
    validateParams(secretParamsSchema),
    validateBody(updateSecretBodySchema),
    asyncHandler(dependencies.vaultController.update),
  );
  router.delete(
    "/vault/secrets/:environment/:key",
    validateParams(secretParamsSchema),
    validateQuery(secretQuerySchema),
    asyncHandler(dependencies.vaultController.delete),
  );

  return router;
}
