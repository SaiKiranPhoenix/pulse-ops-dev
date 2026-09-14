import express, { type Express } from "express";
import { createLogger } from "@pulseops/shared";
import { INCIDENT_LIMITS, SERVICE_NAME } from "./config/constants.js";
import { createErrorMiddleware } from "./middlewares/error.middleware.js";
import { requestIdMiddleware } from "./middlewares/request-id.middleware.js";
import { createRoutes, type RouteDependencies } from "./routes/index.js";
import {
  createIncidentServiceDependencies,
  type IncidentServiceDependencies,
} from "./services/dependencies.js";

export type CreateAppOptions = {
  readonly dependencies?: IncidentServiceDependencies;
};

export function createApp(options: CreateAppOptions = {}): Express {
  const app = express();
  const logger = createLogger({ service: SERVICE_NAME });
  const dependencies = options.dependencies ?? createIncidentServiceDependencies();

  app.disable("x-powered-by");
  app.use(express.json({ limit: INCIDENT_LIMITS.bodyLimit }));
  app.use(requestIdMiddleware);
  app.use(createRoutes(toRouteDependencies(dependencies)));
  app.use(createErrorMiddleware(logger));

  return app;
}

function toRouteDependencies(dependencies: IncidentServiceDependencies): RouteDependencies {
  return {
    incidentController: dependencies.incidentController,
    monitorController: dependencies.monitorController,
    sloController: dependencies.sloController,
    onCallController: dependencies.onCallController,
  };
}
