import express, { type Express } from "express";
import { createLogger } from "@pulseops/shared";
import { SERVICE_NAME, VAULT_LIMITS } from "./config/constants.js";
import { createErrorMiddleware } from "./middlewares/error.middleware.js";
import { requestIdMiddleware } from "./middlewares/request-id.middleware.js";
import { createRoutes, type RouteDependencies } from "./routes/index.js";
import {
  createVaultServiceDependencies,
  type VaultServiceDependencies,
} from "./services/dependencies.js";

export type CreateAppOptions = {
  readonly dependencies?: VaultServiceDependencies;
};

export function createApp(options: CreateAppOptions = {}): Express {
  const app = express();
  const logger = createLogger({ service: SERVICE_NAME });
  const dependencies = options.dependencies ?? createVaultServiceDependencies();

  app.disable("x-powered-by");
  app.use(express.json({ limit: VAULT_LIMITS.bodyLimit }));
  app.use(requestIdMiddleware);
  app.use(createRoutes(toRouteDependencies(dependencies)));
  app.use(createErrorMiddleware(logger));

  return app;
}

function toRouteDependencies(dependencies: VaultServiceDependencies): RouteDependencies {
  return {
    vaultController: dependencies.vaultController,
  };
}
