import express, { type Express } from "express";
import { createLogger } from "@pulseops/shared";
import { AUDIT_LIMITS, SERVICE_NAME } from "./config/constants.js";
import { createErrorMiddleware } from "./middlewares/error.middleware.js";
import { requestIdMiddleware } from "./middlewares/request-id.middleware.js";
import { createRoutes, type RouteDependencies } from "./routes/index.js";
import {
  createAuditServiceDependencies,
  type AuditServiceDependencies,
} from "./services/dependencies.js";

export type CreateAppOptions = {
  readonly dependencies?: AuditServiceDependencies;
};

export function createApp(options: CreateAppOptions = {}): Express {
  const app = express();
  const logger = createLogger({ service: SERVICE_NAME });
  const dependencies = options.dependencies ?? createAuditServiceDependencies();

  app.disable("x-powered-by");
  app.use(express.json({ limit: AUDIT_LIMITS.bodyLimit }));
  app.use(requestIdMiddleware);
  app.use(createRoutes(toRouteDependencies(dependencies)));
  app.use(createErrorMiddleware(logger));

  return app;
}

function toRouteDependencies(dependencies: AuditServiceDependencies): RouteDependencies {
  return {
    auditController: dependencies.auditController,
  };
}
