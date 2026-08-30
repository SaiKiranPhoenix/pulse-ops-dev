import { Router } from "express";
import type { IncidentController } from "../controllers/incident.controller.js";
import type { MonitorController } from "../controllers/monitor.controller.js";
import { createAuthMiddleware } from "../middlewares/auth.middleware.js";
import { validateBody, validateParams, validateQuery } from "../middlewares/validate.middleware.js";
import { asyncHandler } from "../utils/async-handler.js";
import {
  incidentListQuerySchema,
  incidentParamsSchema,
  resolveIncidentBodySchema,
} from "../validators/incident.validator.js";

export type RouteDependencies = {
  readonly incidentController: IncidentController;
  readonly monitorController: MonitorController;
};

export function createRoutes(dependencies: RouteDependencies): Router {
  const router = Router();

  router.get("/health", (_request, response) => {
    response.status(200).json({ status: "ok" });
  });

  router.use(createAuthMiddleware());

  // Incidents
  router.get(
    "/incidents",
    validateQuery(incidentListQuerySchema),
    asyncHandler(dependencies.incidentController.list),
  );
  router.get(
    "/incidents/:incidentId",
    validateParams(incidentParamsSchema),
    validateQuery(incidentListQuerySchema),
    asyncHandler(dependencies.incidentController.detail),
  );
  router.post(
    "/incidents/:incidentId/resolve",
    validateParams(incidentParamsSchema),
    validateQuery(incidentListQuerySchema),
    validateBody(resolveIncidentBodySchema),
    asyncHandler(dependencies.incidentController.resolve),
  );
  router.post(
    "/incidents/:incidentId/acknowledge",
    validateParams(incidentParamsSchema),
    validateQuery(incidentListQuerySchema),
    asyncHandler(dependencies.incidentController.acknowledge),
  );
  router.post(
    "/incidents/:incidentId/reopen",
    validateParams(incidentParamsSchema),
    validateQuery(incidentListQuerySchema),
    asyncHandler(dependencies.incidentController.reopen),
  );

  // Monitors
  router.get("/monitors", asyncHandler(dependencies.monitorController.list));
  router.get("/monitors/export", asyncHandler(dependencies.monitorController.exportMonitors));
  router.post("/monitors/import", asyncHandler(dependencies.monitorController.importMonitors));
  router.post("/monitors", asyncHandler(dependencies.monitorController.create));
  router.get("/monitors/:monitorId", asyncHandler(dependencies.monitorController.detail));
  router.patch("/monitors/:monitorId", asyncHandler(dependencies.monitorController.update));
  router.delete("/monitors/:monitorId", asyncHandler(dependencies.monitorController.remove));
  router.post(
    "/monitors/:monitorId/evaluate",
    asyncHandler(dependencies.monitorController.evaluateManual),
  );

  // Silence & Maintenance Windows
  router.get("/silence-windows", asyncHandler(dependencies.monitorController.listSilenceWindows));
  router.post("/silence-windows", asyncHandler(dependencies.monitorController.createSilenceWindow));
  router.delete(
    "/silence-windows/:id",
    asyncHandler(dependencies.monitorController.deleteSilenceWindow),
  );

  router.get(
    "/maintenance-windows",
    asyncHandler(dependencies.monitorController.listMaintenanceWindows),
  );
  router.post(
    "/maintenance-windows",
    asyncHandler(dependencies.monitorController.createMaintenanceWindow),
  );
  router.delete(
    "/maintenance-windows/:id",
    asyncHandler(dependencies.monitorController.deleteMaintenanceWindow),
  );

  // Notification Channels & Routing
  router.get("/notification-channels", asyncHandler(dependencies.monitorController.listChannels));
  router.post("/notification-channels", asyncHandler(dependencies.monitorController.createChannel));
  router.patch(
    "/notification-channels/:id",
    asyncHandler(dependencies.monitorController.updateChannel),
  );
  router.delete(
    "/notification-channels/:id",
    asyncHandler(dependencies.monitorController.deleteChannel),
  );
  router.post(
    "/notification-channels/:id/test",
    asyncHandler(dependencies.monitorController.testChannel),
  );

  router.get(
    "/notification-routing",
    asyncHandler(dependencies.monitorController.listRoutingRules),
  );
  router.post(
    "/notification-routing",
    asyncHandler(dependencies.monitorController.createRoutingRule),
  );
  router.delete(
    "/notification-routing/:id",
    asyncHandler(dependencies.monitorController.deleteRoutingRule),
  );

  return router;
}
