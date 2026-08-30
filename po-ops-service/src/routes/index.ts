import { Router } from "express";
import type { CustomDashboardController } from "../controllers/custom-dashboard.controller.js";
import type { OpsController } from "../controllers/ops.controller.js";
import { createAuthMiddleware } from "../middlewares/auth.middleware.js";
import { asyncHandler } from "../utils/async-handler.js";

export type RouteDependencies = {
  readonly opsController: OpsController;
  readonly customDashboardController: CustomDashboardController;
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

  return router;
}
