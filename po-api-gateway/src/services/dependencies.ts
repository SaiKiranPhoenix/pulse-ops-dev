import { DashboardController } from "../controllers/dashboard.controller.js";
import { loadEnv } from "../config/env.js";
import { MongoDashboardRepository } from "../repositories/dashboard.repository.js";
import { DashboardService } from "./dashboard.service.js";

export type ApiGatewayDependencies = {
  readonly dashboardController: DashboardController;
  readonly dashboardService: DashboardService;
  readonly jwtSecret: string;
};

export function createApiGatewayDependencies(): ApiGatewayDependencies {
  const env = loadEnv();
  const dashboardService = new DashboardService(new MongoDashboardRepository());

  return {
    dashboardController: new DashboardController(dashboardService),
    dashboardService,
    jwtSecret: env.JWT_SECRET,
  };
}
