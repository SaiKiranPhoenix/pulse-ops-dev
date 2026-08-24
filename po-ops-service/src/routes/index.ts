import { Router } from "express";
import type { OpsController } from "../controllers/ops.controller.js";
import { asyncHandler } from "../utils/async-handler.js";

export type RouteDependencies = {
  readonly opsController: OpsController;
};

export function createRoutes(dependencies: RouteDependencies): Router {
  const router = Router();

  router.get("/health", (_request, response) => {
    response.status(200).json({ status: "ok" });
  });
  router.get("/ops/workers", asyncHandler(dependencies.opsController.workers));
  router.get("/ops/queues", asyncHandler(dependencies.opsController.queues));
  router.get("/ops/summary", asyncHandler(dependencies.opsController.summary));
  router.get("/dashboard/workers", asyncHandler(dependencies.opsController.workers));
  router.get("/dashboard/queues", asyncHandler(dependencies.opsController.queues));

  return router;
}
