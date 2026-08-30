import { Router } from "express";
import type { IncidentController } from "../controllers/incident.controller.js";
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
};

export function createRoutes(dependencies: RouteDependencies): Router {
  const router = Router();

  router.get("/health", (_request, response) => {
    response.status(200).json({ status: "ok" });
  });
  router.use(createAuthMiddleware());
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

  return router;
}
