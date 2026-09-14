import { Router } from "express";
import type { IngestionController } from "../controllers/ingestion.controller.js";
import type { LogPipelineController } from "../controllers/log-pipeline.controller.js";
import { createApiKeyPresenceMiddleware } from "../middlewares/auth.middleware.js";
import { validateBody } from "../middlewares/validate.middleware.js";
import { asyncHandler } from "../utils/async-handler.js";
import {
  errorBodySchema,
  logBodySchema,
  metricBodySchema,
} from "../validators/ingestion.validator.js";
import { spanBodySchema, traceBodySchema } from "@pulseops/shared";

export type RouteDependencies = {
  readonly ingestionController: IngestionController;
  readonly logPipelineController: LogPipelineController;
};

export function createRoutes(dependencies: RouteDependencies): Router {
  const router = Router();

  router.get("/health", (_request, response) => {
    response.status(200).json({ status: "ok" });
  });

  // Telemetry Ingestion
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
  router.post(
    "/ingest/spans",
    createApiKeyPresenceMiddleware(),
    validateBody(spanBodySchema),
    asyncHandler(dependencies.ingestionController.ingestSpan),
  );
  router.post(
    "/ingest/traces",
    createApiKeyPresenceMiddleware(),
    validateBody(traceBodySchema),
    asyncHandler(dependencies.ingestionController.ingestTrace),
  );

  // Log Pipeline Rules
  router.get("/log-pipelines", asyncHandler(dependencies.logPipelineController.listRules));
  router.post("/log-pipelines", asyncHandler(dependencies.logPipelineController.createRule));
  router.get("/log-pipelines/:ruleId", asyncHandler(dependencies.logPipelineController.detailRule));
  router.patch(
    "/log-pipelines/:ruleId",
    asyncHandler(dependencies.logPipelineController.updateRule),
  );
  router.delete(
    "/log-pipelines/:ruleId",
    asyncHandler(dependencies.logPipelineController.deleteRule),
  );

  // Log Retention Settings
  router.get("/logs/retention", asyncHandler(dependencies.logPipelineController.getRetention));
  router.put("/logs/retention", asyncHandler(dependencies.logPipelineController.updateRetention));

  // Saved Log Searches
  router.get(
    "/logs/saved-searches",
    asyncHandler(dependencies.logPipelineController.listSavedSearches),
  );
  router.post(
    "/logs/saved-searches",
    asyncHandler(dependencies.logPipelineController.createSavedSearch),
  );
  router.delete(
    "/logs/saved-searches/:searchId",
    asyncHandler(dependencies.logPipelineController.deleteSavedSearch),
  );

  // Log Context Window (+-25 events)
  router.get("/logs/:eventId/context", asyncHandler(dependencies.logPipelineController.getContext));

  // Volume Analytics
  router.get(
    "/logs/analytics/volume",
    asyncHandler(dependencies.logPipelineController.getVolumeAnalytics),
  );

  // Log Export / Archive Download
  router.get("/logs/export", asyncHandler(dependencies.logPipelineController.exportLogs));

  return router;
}
