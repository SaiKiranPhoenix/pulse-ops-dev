import { Router } from "express";
import type { AuditController } from "../controllers/audit.controller.js";
import { createAuthMiddleware } from "../middlewares/auth.middleware.js";
import { asyncHandler } from "../utils/async-handler.js";

export type RouteDependencies = {
  readonly auditController: AuditController;
};

export function createRoutes(dependencies: RouteDependencies): Router {
  const router = Router();

  router.get("/health", (_request, response) => {
    response.status(200).json({ status: "ok" });
  });
  router.use(createAuthMiddleware());
  router.get("/audit/events", asyncHandler(dependencies.auditController.list));
  router.get("/audit/events/export", asyncHandler(dependencies.auditController.export));
  router.get("/audit/compliance/report", asyncHandler(dependencies.auditController.report));
  router.get("/audit/compliance/integrity", asyncHandler(dependencies.auditController.integrity));

  return router;
}
