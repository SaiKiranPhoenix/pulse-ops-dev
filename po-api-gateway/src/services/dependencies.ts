import { DashboardController } from "../controllers/dashboard.controller.js";
import { GatewayController } from "../controllers/gateway.controller.js";
import { ProxyController, type ProxyTargets } from "../controllers/proxy.controller.js";
import { loadEnv } from "../config/env.js";
import { MongoDashboardRepository } from "../repositories/dashboard.repository.js";
import { DashboardService } from "./dashboard.service.js";
import { GatewayService } from "./gateway.service.js";
import { ProxyService } from "./proxy.service.js";

export type ApiGatewayDependencies = {
  readonly dashboardController: DashboardController;
  readonly dashboardService: DashboardService;
  readonly gatewayController: GatewayController;
  readonly gatewayService: GatewayService;
  readonly proxyController: ProxyController;
  readonly proxyService: ProxyService;
  readonly jwtSecret: string;
  readonly corsAllowedOrigins: string;
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
    audit: {
      baseUrl: env.AUDIT_SERVICE_URL,
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
    ops: {
      baseUrl: env.OPS_SERVICE_URL,
      pathPrefix: "",
    },
    vault: {
      baseUrl: env.VAULT_SERVICE_URL,
      pathPrefix: "",
    },
  };
  const gatewayService = new GatewayService(proxyTargets);

  return {
    dashboardController: new DashboardController(dashboardService),
    dashboardService,
    gatewayController: new GatewayController(gatewayService),
    gatewayService,
    proxyController: new ProxyController(proxyService, proxyTargets),
    proxyService,
    jwtSecret: env.JWT_SECRET,
    corsAllowedOrigins: env.CORS_ALLOWED_ORIGINS,
  };
}
