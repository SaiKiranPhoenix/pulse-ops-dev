import { Router } from "express";
import { AuthController } from "../controllers/auth.controller.js";
import { createAuthMiddleware } from "../middlewares/auth.middleware.js";
import { validateBody } from "../middlewares/validate.middleware.js";
import type { TokenService } from "../services/token.service.js";
import { asyncHandler } from "../utils/async-handler.js";
import { loginUserBodySchema, registerUserBodySchema } from "../validators/auth.validator.js";

export function createAuthRouter(controller: AuthController, tokenService: TokenService): Router {
  const router = Router();
  const requireAuth = createAuthMiddleware(tokenService);

  router.post("/register", validateBody(registerUserBodySchema), asyncHandler(controller.register));
  router.post("/login", validateBody(loginUserBodySchema), asyncHandler(controller.login));
  router.get("/me", requireAuth, asyncHandler(controller.currentUser));

  return router;
}
