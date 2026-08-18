import { Router } from "express";
import { AuthController } from "../controllers/auth.controller.js";
import { validateBody } from "../middlewares/validate.middleware.js";
import { asyncHandler } from "../utils/async-handler.js";
import { registerUserBodySchema } from "../validators/auth.validator.js";

export function createAuthRouter(controller: AuthController): Router {
  const router = Router();

  router.post("/register", validateBody(registerUserBodySchema), asyncHandler(controller.register));

  return router;
}
