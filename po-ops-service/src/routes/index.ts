import { Router } from "express";
import type { CustomDashboardController } from "../controllers/custom-dashboard.controller.js";
import type { InfrastructureController } from "../controllers/infrastructure.controller.js";
import type { MetricsPlatformController } from "../controllers/metrics-platform.controller.js";
import type { OpsController } from "../controllers/ops.controller.js";
import type { UptimeRumController } from "../controllers/uptime-rum.controller.js";
import { createAuthMiddleware } from "../middlewares/auth.middleware.js";
import { asyncHandler } from "../utils/async-handler.js";

export type RouteDependencies = {
  readonly opsController: OpsController;
  readonly customDashboardController: CustomDashboardController;
  readonly metricsPlatformController: MetricsPlatformController;
  readonly infrastructureController: InfrastructureController;
  readonly uptimeRumController: UptimeRumController;
};

export function createRoutes(dependencies: RouteDependencies): Router {
  const router = Router();

  router.get("/health", (_request, response) => {
    response.status(200).json({ status: "ok" });
  });

  router.use(createAuthMiddleware());

  // Ops & Queue Management
  router.get("/ops/workers", asyncHandler(dependencies.opsController.workers));
  router.get("/ops/queues", asyncHandler(dependencies.opsController.queues));
  router.get("/ops/dead-letters", asyncHandler(dependencies.opsController.deadLetters));
  router.post(
    "/ops/dead-letters/replay",
    asyncHandler(dependencies.opsController.replayDeadLetters),
  );
  router.get("/ops/summary", asyncHandler(dependencies.opsController.summary));
  router.get("/dashboard/workers", asyncHandler(dependencies.opsController.workers));
  router.get("/dashboard/queues", asyncHandler(dependencies.opsController.queues));
  router.get("/dashboard/dead-letters", asyncHandler(dependencies.opsController.deadLetters));

  // Custom Dashboards
  router.get(
    "/custom-dashboards",
    asyncHandler(dependencies.customDashboardController.list),
  );
  router.post(
    "/custom-dashboards",
    asyncHandler(dependencies.customDashboardController.create),
  );
  router.post(
    "/custom-dashboards/seed-templates",
    asyncHandler(dependencies.customDashboardController.seedTemplates),
  );
  router.get(
    "/custom-dashboards/:dashboardId",
    asyncHandler(dependencies.customDashboardController.detail),
  );
  router.patch(
    "/custom-dashboards/:dashboardId",
    asyncHandler(dependencies.customDashboardController.update),
  );
  router.delete(
    "/custom-dashboards/:dashboardId",
    asyncHandler(dependencies.customDashboardController.remove),
  );
  router.post(
    "/custom-dashboards/:dashboardId/clone",
    asyncHandler(dependencies.customDashboardController.clone),
  );

  // Query Explorer
  router.get("/explorer/query", asyncHandler(dependencies.customDashboardController.queryExplorer));
  router.post("/explorer/query", asyncHandler(dependencies.customDashboardController.queryExplorer));

  // Metrics Platform
  router.get("/metrics/catalog", asyncHandler(dependencies.metricsPlatformController.listDefinitions));
  router.post("/metrics/catalog", asyncHandler(dependencies.metricsPlatformController.createDefinition));
  router.patch("/metrics/catalog/:id", asyncHandler(dependencies.metricsPlatformController.updateDefinition));
  router.delete("/metrics/catalog/:id", asyncHandler(dependencies.metricsPlatformController.deleteDefinition));
  router.get("/metrics/query", asyncHandler(dependencies.metricsPlatformController.queryMetric));
  router.get("/metrics/services/summary", asyncHandler(dependencies.metricsPlatformController.getServiceMetricsSummary));
  router.get("/metrics/cardinality/guardrails", asyncHandler(dependencies.metricsPlatformController.getCardinalityGuardrails));

  // Infrastructure & Containers
  router.get("/infra/overview", asyncHandler(dependencies.infrastructureController.getOverview));
  router.get("/infra/hosts", asyncHandler(dependencies.infrastructureController.listHosts));
  router.get("/infra/containers", asyncHandler(dependencies.infrastructureController.listContainers));
  router.get("/infra/dependencies", asyncHandler(dependencies.infrastructureController.getDependencies));

  // Uptime & Synthetics
  router.get("/uptime/checks", asyncHandler(dependencies.uptimeRumController.listChecks));
  router.post("/uptime/checks", asyncHandler(dependencies.uptimeRumController.createCheck));
  router.patch("/uptime/checks/:id", asyncHandler(dependencies.uptimeRumController.updateCheck));
  router.delete("/uptime/checks/:id", asyncHandler(dependencies.uptimeRumController.deleteCheck));
  router.post("/uptime/checks/:id/test", asyncHandler(dependencies.uptimeRumController.testCheck));
  router.get("/uptime/checks/:id/history", asyncHandler(dependencies.uptimeRumController.getCheckHistory));

  // Real User Monitoring (RUM)
  router.get("/rum/overview", asyncHandler(dependencies.uptimeRumController.getRumOverview));
  router.post("/rum/vitals", asyncHandler(dependencies.uptimeRumController.recordRumVitals));

  return router;
}
