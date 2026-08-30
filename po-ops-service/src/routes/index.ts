import { Router } from "express";
import type { OpsController } from "../controllers/ops.controller.js";
import { createAuthMiddleware } from "../middlewares/auth.middleware.js";
import { asyncHandler } from "../utils/async-handler.js";

export type RouteDependencies = {
  readonly opsController: OpsController;
};

export function createRoutes(dependencies: RouteDependencies): Router {
  const router = Router();

  router.get("/health", (_request, response) => {
    response.status(200).json({ status: "ok" });
  });
  router.use(createAuthMiddleware());
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

  return router;
}
