import { Router } from "express";
import type { DashboardController } from "../controllers/dashboard.controller.js";
import type { ProxyController } from "../controllers/proxy.controller.js";
import { createAuthMiddleware } from "../middlewares/auth.middleware.js";
import { validateQuery } from "../middlewares/validate.middleware.js";
import { asyncHandler } from "../utils/async-handler.js";
import { projectQuerySchema } from "../validators/dashboard.validator.js";

export type RouteDependencies = {
  readonly dashboardController: DashboardController;
  readonly proxyController: ProxyController;
  readonly jwtSecret: string;
};

export function createRoutes(dependencies: RouteDependencies): Router {
  const router = Router();
  const requireAuth = createAuthMiddleware(dependencies.jwtSecret);

  router.get("/health", (_request, response) => {
    response.status(200).json({ status: "ok" });
  });

  router.use("/auth", asyncHandler(dependencies.proxyController.authProject));
  router.use("/audit", requireAuth, asyncHandler(dependencies.proxyController.audit));
  router.use("/integrations/vault", asyncHandler(dependencies.proxyController.vault));
  router.use("/projects", requireAuth, asyncHandler(dependencies.proxyController.authProject));
  router.use("/ingest", asyncHandler(dependencies.proxyController.ingestion));
  router.use("/incidents", requireAuth, asyncHandler(dependencies.proxyController.incident));
  router.use("/ops", requireAuth, asyncHandler(dependencies.proxyController.ops));
  router.use("/vault", requireAuth, asyncHandler(dependencies.proxyController.vault));

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
  router.get("/dashboard/workers", asyncHandler(dependencies.proxyController.ops));
  router.get("/dashboard/queues", asyncHandler(dependencies.proxyController.ops));
  router.get(
    "/dashboard/vault-activity",
    validateQuery(projectQuerySchema),
    asyncHandler(dependencies.dashboardController.vaultActivity),
  );

  return router;
}
