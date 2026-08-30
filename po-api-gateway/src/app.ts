import express, { type Express } from "express";
import { createLogger } from "@pulseops/shared";
import { GATEWAY_LIMITS, SERVICE_NAME } from "./config/constants.js";
import { createErrorMiddleware } from "./middlewares/error.middleware.js";
import { createCorsMiddleware } from "./middlewares/cors.middleware.js";
import { requestIdMiddleware } from "./middlewares/request-id.middleware.js";
import { createRequestLoggingMiddleware } from "./middlewares/request-logging.middleware.js";
import { createGatewayRateLimitMiddleware } from "./middlewares/rate-limit.middleware.js";
import { createRoutes, type RouteDependencies } from "./routes/index.js";
import {
  createApiGatewayDependencies,
  type ApiGatewayDependencies,
} from "./services/dependencies.js";

export type CreateAppOptions = {
  readonly dependencies?: ApiGatewayDependencies;
};

export function createApp(options: CreateAppOptions = {}): Express {
  const app = express();
  const logger = createLogger({ service: SERVICE_NAME });
  const dependencies = options.dependencies ?? createApiGatewayDependencies();

  app.disable("x-powered-by");
  app.use(createCorsMiddleware(dependencies.corsAllowedOrigins));
  app.use(express.json({ limit: GATEWAY_LIMITS.bodyLimit }));
  app.use(requestIdMiddleware);
  app.use(createRequestLoggingMiddleware(logger));
  app.use(
    createGatewayRateLimitMiddleware({
      limit: GATEWAY_LIMITS.requestsPerMinute,
      windowMs: GATEWAY_LIMITS.rateLimitWindowMs,
    }),
  );
  app.use(createRoutes(toRouteDependencies(dependencies)));
  app.use(createErrorMiddleware(logger));

  return app;
}

function toRouteDependencies(dependencies: ApiGatewayDependencies): RouteDependencies {
  return {
    dashboardController: dependencies.dashboardController,
    serviceController: dependencies.serviceController,
    gatewayController: dependencies.gatewayController,
    proxyController: dependencies.proxyController,
    projectAuthorization: dependencies.projectAuthorization,
    jwtSecret: dependencies.jwtSecret,
  };
}
