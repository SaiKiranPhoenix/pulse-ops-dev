import express, { type Express } from "express";
import { createLogger } from "@pulseops/shared";
import { SERVICE_NAME } from "./config/constants.js";
import { createErrorMiddleware } from "./middlewares/error.middleware.js";
import { requestIdMiddleware } from "./middlewares/request-id.middleware.js";
import { createRoutes, type RouteDependencies } from "./routes/index.js";
import {
  createAuthProjectServiceDependencies,
  type AuthProjectServiceDependencies,
} from "./services/dependencies.js";

export type CreateAppOptions = {
  readonly dependencies?: AuthProjectServiceDependencies;
};

export function createApp(options: CreateAppOptions = {}): Express {
  const app = express();
  const logger = createLogger({ service: SERVICE_NAME });
  const dependencies = options.dependencies ?? createAuthProjectServiceDependencies();
  app.locals.closeDependencies = dependencies.close;

  app.disable("x-powered-by");
  app.use(express.json({ limit: "256kb" }));
  app.use(requestIdMiddleware);
  app.use(createRoutes(toRouteDependencies(dependencies)));
  app.use(createErrorMiddleware(logger));

  return app;
}

function toRouteDependencies(dependencies: AuthProjectServiceDependencies): RouteDependencies {
  return {
    authController: dependencies.authController,
    projectController: dependencies.projectController,
    tokenService: dependencies.tokenService,
  };
}
