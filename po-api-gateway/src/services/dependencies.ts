import { DashboardController } from "../controllers/dashboard.controller.js";
import { ProxyController, type ProxyTargets } from "../controllers/proxy.controller.js";
import { loadEnv } from "../config/env.js";
import { MongoDashboardRepository } from "../repositories/dashboard.repository.js";
import { DashboardService } from "./dashboard.service.js";
import { ProxyService } from "./proxy.service.js";

export type ApiGatewayDependencies = {
  readonly dashboardController: DashboardController;
  readonly dashboardService: DashboardService;
  readonly proxyController: ProxyController;
  readonly proxyService: ProxyService;
  readonly jwtSecret: string;
};

export function createApiGatewayDependencies(): ApiGatewayDependencies {
  const env = loadEnv();
  const dashboardService = new DashboardService(new MongoDashboardRepository());
  const proxyService = new ProxyService();
  const proxyTargets: ProxyTargets = {
    authProject: {
      baseUrl: env.AUTH_PROJECT_SERVICE_URL,
      pathPrefix: "",
    },
    ingestion: {
      baseUrl: env.INGESTION_SERVICE_URL,
      pathPrefix: "",
    },
    incident: {
      baseUrl: env.INCIDENT_SERVICE_URL,
      pathPrefix: "",
    },
    vault: {
      baseUrl: env.VAULT_SERVICE_URL,
      pathPrefix: "",
    },
  };

  return {
    dashboardController: new DashboardController(dashboardService),
    dashboardService,
    proxyController: new ProxyController(proxyService, proxyTargets),
    proxyService,
    jwtSecret: env.JWT_SECRET,
  };
}
