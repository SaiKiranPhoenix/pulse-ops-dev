import { Router } from "express";
import { AuthController } from "../controllers/auth.controller.js";
import { createAuthRouter } from "./auth.routes.js";

export type RouteDependencies = {
  readonly authController: AuthController;
};

export function createRoutes(dependencies: RouteDependencies): Router {
  const router = Router();

  router.get("/health", (_request, response) => {
    response.status(200).json({ status: "ok" });
  });

  router.use("/auth", createAuthRouter(dependencies.authController));

  return router;
}
