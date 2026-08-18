import { Router } from "express";
import { AuthController } from "../controllers/auth.controller.js";
import { ProjectController } from "../controllers/project.controller.js";
import type { TokenService } from "../services/token.service.js";
import { createAuthRouter } from "./auth.routes.js";
import { createProjectRouter } from "./project.routes.js";

export type RouteDependencies = {
  readonly authController: AuthController;
  readonly projectController: ProjectController;
  readonly tokenService: TokenService;
};

export function createRoutes(dependencies: RouteDependencies): Router {
  const router = Router();

  router.get("/health", (_request, response) => {
    response.status(200).json({ status: "ok" });
  });

  router.use("/auth", createAuthRouter(dependencies.authController, dependencies.tokenService));
  router.use(
    "/projects",
    createProjectRouter(dependencies.projectController, dependencies.tokenService),
  );

  return router;
}
