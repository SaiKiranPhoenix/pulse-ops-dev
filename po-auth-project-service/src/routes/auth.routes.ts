import { Router } from "express";
import { AuthController } from "../controllers/auth.controller.js";
import { createAuthMiddleware } from "../middlewares/auth.middleware.js";
import { validateBody, validateParams, validateQuery } from "../middlewares/validate.middleware.js";
import type { TokenService } from "../services/token.service.js";
import { asyncHandler } from "../utils/async-handler.js";
import {
  loginUserBodySchema,
  oauthCallbackQuerySchema,
  oauthProviderParamsSchema,
  registerUserBodySchema,
} from "../validators/auth.validator.js";

export function createAuthRouter(controller: AuthController, tokenService: TokenService): Router {
  const router = Router();
  const requireAuth = createAuthMiddleware(tokenService);

  router.post("/register", validateBody(registerUserBodySchema), asyncHandler(controller.register));
  router.post("/login", validateBody(loginUserBodySchema), asyncHandler(controller.login));
  router.get(
    "/oauth/:provider/start",
    validateParams(oauthProviderParamsSchema),
    asyncHandler(controller.oauthStart),
  );
  router.get(
    "/oauth/:provider/callback",
    validateParams(oauthProviderParamsSchema),
    validateQuery(oauthCallbackQuerySchema),
    asyncHandler(controller.oauthCallback),
  );
  router.get("/me", requireAuth, asyncHandler(controller.currentUser));

  return router;
}
