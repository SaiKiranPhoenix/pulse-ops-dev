import { Router } from "express";
import type { IngestionController } from "../controllers/ingestion.controller.js";
import { createApiKeyPresenceMiddleware } from "../middlewares/auth.middleware.js";
import { validateBody } from "../middlewares/validate.middleware.js";
import { asyncHandler } from "../utils/async-handler.js";
import {
  errorBodySchema,
  logBodySchema,
  metricBodySchema,
} from "../validators/ingestion.validator.js";

export type RouteDependencies = {
  readonly ingestionController: IngestionController;
};

export function createRoutes(dependencies: RouteDependencies): Router {
  const router = Router();

  router.get("/health", (_request, response) => {
    response.status(200).json({ status: "ok" });
  });
  router.post(
    "/ingest/logs",
    createApiKeyPresenceMiddleware(),
    validateBody(logBodySchema),
    asyncHandler(dependencies.ingestionController.ingestLog),
  );
  router.post(
    "/ingest/errors",
    createApiKeyPresenceMiddleware(),
    validateBody(errorBodySchema),
    asyncHandler(dependencies.ingestionController.ingestError),
  );
  router.post(
    "/ingest/metrics",
    createApiKeyPresenceMiddleware(),
    validateBody(metricBodySchema),
    asyncHandler(dependencies.ingestionController.ingestMetric),
  );

  return router;
}
