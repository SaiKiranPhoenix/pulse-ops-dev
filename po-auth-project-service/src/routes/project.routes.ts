import { Router } from "express";
import { ProjectController } from "../controllers/project.controller.js";
import { createAuthMiddleware } from "../middlewares/auth.middleware.js";
import { validateBody, validateParams } from "../middlewares/validate.middleware.js";
import type { TokenService } from "../services/token.service.js";
import { asyncHandler } from "../utils/async-handler.js";
import {
  apiKeyParamsSchema,
  createApiKeyBodySchema,
  createProjectBodySchema,
  projectParamsSchema,
} from "../validators/project.validator.js";

export function createProjectRouter(
  controller: ProjectController,
  tokenService: TokenService,
): Router {
  const router = Router();
  const requireAuth = createAuthMiddleware(tokenService);

  router.use(requireAuth);
  router.post("/", validateBody(createProjectBodySchema), asyncHandler(controller.create));
  router.get("/", asyncHandler(controller.list));
  router.get("/:projectId", validateParams(projectParamsSchema), asyncHandler(controller.detail));
  router.post(
    "/:projectId/archive",
    validateParams(projectParamsSchema),
    asyncHandler(controller.archive),
  );
  router.post(
    "/:projectId/restore",
    validateParams(projectParamsSchema),
    asyncHandler(controller.restore),
  );
  router.post(
    "/:projectId/api-keys",
    validateParams(projectParamsSchema),
    validateBody(createApiKeyBodySchema),
    asyncHandler(controller.createApiKey),
  );
  router.get(
    "/:projectId/api-keys",
    validateParams(projectParamsSchema),
    asyncHandler(controller.listApiKeys),
  );
  router.post(
    "/:projectId/api-keys/:apiKeyId/rotate",
    validateParams(apiKeyParamsSchema),
    asyncHandler(controller.rotateApiKey),
  );
  router.post(
    "/:projectId/api-keys/:apiKeyId/disable",
    validateParams(apiKeyParamsSchema),
    asyncHandler(controller.disableApiKey),
  );

  return router;
}
