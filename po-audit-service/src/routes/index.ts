import { Router } from "express";
import type { AuditController } from "../controllers/audit.controller.js";
import { asyncHandler } from "../utils/async-handler.js";

export type RouteDependencies = {
  readonly auditController: AuditController;
};

export function createRoutes(dependencies: RouteDependencies): Router {
  const router = Router();

  router.get("/health", (_request, response) => {
    response.status(200).json({ status: "ok" });
  });
  router.get("/audit/events", asyncHandler(dependencies.auditController.list));

  return router;
}
