import { Router } from "express";
import type { DashboardController } from "../controllers/dashboard.controller.js";
import type { GatewayController } from "../controllers/gateway.controller.js";
import type { ProxyController } from "../controllers/proxy.controller.js";
import type { ServiceController } from "../controllers/service.controller.js";
import { createAuthMiddleware } from "../middlewares/auth.middleware.js";
import { createProjectAccessMiddleware } from "../middlewares/project-access.middleware.js";
import { validateBody, validateParams, validateQuery } from "../middlewares/validate.middleware.js";
import type { ProjectAuthorizationRepository } from "../repositories/project-authorization.repository.js";
import { asyncHandler } from "../utils/async-handler.js";
import {
  dashboardAnalyticsQuerySchema,
  dashboardEventsQuerySchema,
  projectQuerySchema,
} from "../validators/dashboard.validator.js";
import {
  serviceParamsSchema,
  serviceQuerySchema,
  upsertServiceBodySchema,
} from "../validators/service.validator.js";

export type RouteDependencies = {
  readonly dashboardController: DashboardController;
  readonly gatewayController: GatewayController;
  readonly proxyController: ProxyController;
  readonly serviceController: ServiceController;
  readonly projectAuthorization: ProjectAuthorizationRepository;
  readonly jwtSecret: string;
};

export function createRoutes(dependencies: RouteDependencies): Router {
  const router = Router();
  const requireAuth = createAuthMiddleware(dependencies.jwtSecret);
  const requireProjectAccess = createProjectAccessMiddleware(dependencies.projectAuthorization);

  router.get("/health", (_request, response) => {
    response.status(200).json({ status: "ok" });
  });
  router.get("/health/services", asyncHandler(dependencies.gatewayController.health));
  router.get("/openapi.json", asyncHandler(dependencies.gatewayController.openApi));

  router.use("/auth", asyncHandler(dependencies.proxyController.authProject));
  router.use(
    "/audit",
    requireAuth,
    requireProjectAccess,
    asyncHandler(dependencies.proxyController.audit),
  );
  router.use("/integrations/vault", asyncHandler(dependencies.proxyController.vault));
  router.use("/projects", requireAuth, asyncHandler(dependencies.proxyController.authProject));
  router.use("/organizations", requireAuth, asyncHandler(dependencies.proxyController.authProject));
  router.use("/ingest", asyncHandler(dependencies.proxyController.ingestion));
  router.use(
    "/incidents",
    requireAuth,
    requireProjectAccess,
    asyncHandler(dependencies.proxyController.incident),
  );
  router.use(
    "/monitors",
    requireAuth,
    requireProjectAccess,
    asyncHandler(dependencies.proxyController.incident),
  );
  router.use(
    "/silence-windows",
    requireAuth,
    requireProjectAccess,
    asyncHandler(dependencies.proxyController.incident),
  );
  router.use(
    "/maintenance-windows",
    requireAuth,
    requireProjectAccess,
    asyncHandler(dependencies.proxyController.incident),
  );
  router.use(
    "/notification-channels",
    requireAuth,
    requireProjectAccess,
    asyncHandler(dependencies.proxyController.incident),
  );
  router.use(
    "/notification-routing",
    requireAuth,
    requireProjectAccess,
    asyncHandler(dependencies.proxyController.incident),
  );
  router.use("/ops", requireAuth, asyncHandler(dependencies.proxyController.ops));
  router.use(
    "/vault",
    requireAuth,
    requireProjectAccess,
    asyncHandler(dependencies.proxyController.vault),
  );

  router.use("/dashboard", requireAuth);
  router.get(
    "/dashboard/summary",
    validateQuery(projectQuerySchema),
    asyncHandler(dependencies.dashboardController.summary),
  );
  router.get(
    "/dashboard/events",
    validateQuery(dashboardEventsQuerySchema),
    asyncHandler(dependencies.dashboardController.events),
  );
  router.get(
    "/dashboard/ingestion",
    validateQuery(dashboardAnalyticsQuerySchema),
    asyncHandler(dependencies.dashboardController.ingestionStats),
  );
  router.get(
    "/dashboard/error-groups",
    validateQuery(dashboardAnalyticsQuerySchema),
    asyncHandler(dependencies.dashboardController.errorGroups),
  );
  router.get(
    "/dashboard/metrics",
    validateQuery(dashboardAnalyticsQuerySchema),
    asyncHandler(dependencies.dashboardController.metricSummary),
  );
  router.get(
    "/dashboard/traces",
    validateQuery(dashboardAnalyticsQuerySchema),
    asyncHandler(dependencies.dashboardController.traceSummary),
  );
  router.get(
    "/dashboard/incidents",
    validateQuery(projectQuerySchema),
    asyncHandler(dependencies.dashboardController.incidents),
  );
  router.get("/dashboard/workers", asyncHandler(dependencies.proxyController.ops));
  router.get("/dashboard/queues", asyncHandler(dependencies.proxyController.ops));
  router.get("/dashboard/dead-letters", asyncHandler(dependencies.proxyController.ops));
  router.get(
    "/dashboard/vault-activity",
    validateQuery(projectQuerySchema),
    asyncHandler(dependencies.dashboardController.vaultActivity),
  );

  // Service Catalog Endpoints
  router.get(
    "/dashboard/services",
    validateQuery(serviceQuerySchema),
    asyncHandler(dependencies.serviceController.list),
  );
  router.get(
    "/dashboard/services/:serviceName",
    validateQuery(serviceQuerySchema),
    validateParams(serviceParamsSchema),
    asyncHandler(dependencies.serviceController.detail),
  );
  router.post(
    "/dashboard/services",
    validateQuery(serviceQuerySchema),
    validateBody(upsertServiceBodySchema),
    asyncHandler(dependencies.serviceController.upsert),
  );
  router.delete(
    "/dashboard/services/:serviceName",
    validateQuery(serviceQuerySchema),
    validateParams(serviceParamsSchema),
    asyncHandler(dependencies.serviceController.delete),
  );

  return router;
}
