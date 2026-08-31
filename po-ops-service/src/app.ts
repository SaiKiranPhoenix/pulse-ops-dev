import express, { type Express } from "express";
import { createLogger } from "@pulseops/shared";
import { OPS_LIMITS, SERVICE_NAME } from "./config/constants.js";
import { createErrorMiddleware } from "./middlewares/error.middleware.js";
import { requestIdMiddleware } from "./middlewares/request-id.middleware.js";
import { createRoutes, type RouteDependencies } from "./routes/index.js";
import type { OpsServiceDependencies } from "./services/dependencies.js";

export type CreateAppOptions = {
  readonly dependencies: OpsServiceDependencies;
};

export function createApp(options: CreateAppOptions): Express {
  const app = express();
  const logger = createLogger({ service: SERVICE_NAME });

  app.disable("x-powered-by");
  app.use(express.json({ limit: OPS_LIMITS.bodyLimit }));
  app.use(requestIdMiddleware);
  app.use(createRoutes(toRouteDependencies(options.dependencies)));
  app.use(createErrorMiddleware(logger));
  app.locals.closeDependencies = options.dependencies.close;

  return app;
}

function toRouteDependencies(dependencies: OpsServiceDependencies): RouteDependencies {
  return {
    opsController: dependencies.opsController,
    customDashboardController: dependencies.customDashboardController,
    metricsPlatformController: dependencies.metricsPlatformController,
    infrastructureController: dependencies.infrastructureController,
  };
}
