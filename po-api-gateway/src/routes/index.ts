import { Router } from "express";
import type { DashboardController } from "../controllers/dashboard.controller.js";
import { createAuthMiddleware } from "../middlewares/auth.middleware.js";
import { validateQuery } from "../middlewares/validate.middleware.js";
import { asyncHandler } from "../utils/async-handler.js";
import { projectQuerySchema } from "../validators/dashboard.validator.js";

export type RouteDependencies = {
  readonly dashboardController: DashboardController;
  readonly jwtSecret: string;
};

export function createRoutes(dependencies: RouteDependencies): Router {
  const router = Router();
  const requireAuth = createAuthMiddleware(dependencies.jwtSecret);

  router.get("/health", (_request, response) => {
    response.status(200).json({ status: "ok" });
  });

  router.use("/dashboard", requireAuth);
  router.get(
    "/dashboard/summary",
    validateQuery(projectQuerySchema),
    asyncHandler(dependencies.dashboardController.summary),
  );
  router.get(
    "/dashboard/events",
    validateQuery(projectQuerySchema),
    asyncHandler(dependencies.dashboardController.events),
  );
  router.get(
    "/dashboard/incidents",
    validateQuery(projectQuerySchema),
    asyncHandler(dependencies.dashboardController.incidents),
  );
  router.get("/dashboard/workers", asyncHandler(dependencies.dashboardController.workers));
  router.get("/dashboard/queues", asyncHandler(dependencies.dashboardController.queues));
  router.get(
    "/dashboard/vault-activity",
    validateQuery(projectQuerySchema),
    asyncHandler(dependencies.dashboardController.vaultActivity),
  );

  return router;
}
