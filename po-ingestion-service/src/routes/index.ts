import { Router } from "express";
import type { IngestionController } from "../controllers/ingestion.controller.js";
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
    validateBody(logBodySchema),
    asyncHandler(dependencies.ingestionController.ingestLog),
  );
  router.post(
    "/ingest/errors",
    validateBody(errorBodySchema),
    asyncHandler(dependencies.ingestionController.ingestError),
  );
  router.post(
    "/ingest/metrics",
    validateBody(metricBodySchema),
    asyncHandler(dependencies.ingestionController.ingestMetric),
  );

  return router;
}
