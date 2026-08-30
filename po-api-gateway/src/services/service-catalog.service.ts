import { forbidden, notFound } from "@pulseops/shared";
import type {
  CreateOrUpdateServiceInput,
  SafeServiceRecord,
  ServiceRepository,
} from "../repositories/service.repository.js";
import type {
  DashboardIncident,
  DashboardRepository,
} from "../repositories/dashboard.repository.js";
import type { ProjectAuthorizationRepository } from "../repositories/project-authorization.repository.js";
import { defaultChecklist } from "../repositories/service.repository.js";

export type ServiceHealthStatus = "healthy" | "degraded" | "critical";

export type ServiceHealthScore = {
  readonly score: number; // 0 - 100
  readonly status: ServiceHealthStatus;
  readonly errorPenalty: number;
  readonly incidentPenalty: number;
  readonly latencyPenalty: number;
  readonly readinessScore: number;
};

export type ServiceCatalogItemDto = SafeServiceRecord & {
  readonly health: ServiceHealthScore;
  readonly stats: {
    readonly totalEvents24h: number;
    readonly errorCount24h: number;
    readonly errorRate24h: number;
    readonly p95LatencyMs: number | null;
    readonly avgLatencyMs: number | null;
    readonly openIncidentsCount: number;
  };
};

export type ServiceDependencyEdge = {
  readonly service: string;
  readonly callCount: number;
  readonly errorCount: number;
  readonly avgLatencyMs: number;
};

export type ServiceDetailDto = ServiceCatalogItemDto & {
  readonly dependencies: {
    readonly inbound: ServiceDependencyEdge[];
    readonly outbound: ServiceDependencyEdge[];
  };
  readonly recentErrors: Array<{
    readonly id: string;
    readonly fingerprint: string;
    readonly message: string | null;
    readonly level: string | null;
    readonly observedAt: string;
    readonly count: number;
  }>;
  readonly recentIncidents: Array<{
    readonly id: string;
    readonly title: string;
    readonly severity: string;
    readonly status: string;
    readonly eventCount: number;
    readonly createdAt: string;
  }>;
  readonly relatedSecretsCount: number;
};

export class ServiceCatalogService {
  constructor(
    private readonly serviceRepo: ServiceRepository,
    private readonly dashboardRepo: DashboardRepository,
    private readonly projectAuth: ProjectAuthorizationRepository,
  ) {}

  async listServices(userId: string, projectId: string): Promise<ServiceCatalogItemDto[]> {
    await this.ensureProjectAccess(projectId, userId);

    const [registeredServices, distinctSources, metricSummary, incidents] = await Promise.all([
      this.serviceRepo.findServicesForProject(projectId),
      this.serviceRepo.listDistinctSources(projectId),
      this.dashboardRepo.metricSummary(projectId, { since: new Date(Date.now() - 86_400_000) }),
      this.dashboardRepo.latestIncidents(projectId),
    ]);

    const registeredMap = new Map(registeredServices.map((s) => [s.name.toLowerCase(), s]));

    // Auto-discover any telemetry source not yet registered
    for (const source of distinctSources) {
      if (!registeredMap.has(source)) {
        const autoDiscovered = await this.serviceRepo.upsertService({
          projectId,
          name: source,
          displayName: formatServiceName(source),
          isAutoDiscovered: true,
          status: "discovered",
          language: guessLanguage(source),
          runtime: "docker",
          tier: "tier_2",
          tags: ["auto-discovered"],
          onboardingChecklist: defaultChecklist(),
        });
        registeredMap.set(source, autoDiscovered);
      }
    }

    const serviceStatsMap = new Map(
      metricSummary.services.map((s) => [s.service.toLowerCase(), s]),
    );

    const result: ServiceCatalogItemDto[] = [];
    for (const service of registeredMap.values()) {
      const stats = serviceStatsMap.get(service.name.toLowerCase());
      const openIncidents = incidents.filter(
        (inc) =>
          inc.status !== "resolved" &&
          inc.samples.some((sample) => sample.source.toLowerCase() === service.name.toLowerCase()),
      );

      const totalEvents = stats?.events ?? 0;
      const errorCount = stats?.errors ?? 0;
      const errorRate = stats?.errorRate ?? 0;
      const avgLatencyMs = stats?.avgLatencyMs ?? null;
      const p95LatencyMs = metricSummary.p95LatencyMs ?? null;

      const health = calculateHealthScore({
        errorRate,
        openIncidents,
        p95LatencyMs,
        checklist: service.onboardingChecklist,
      });

      result.push({
        ...service,
        health,
        stats: {
          totalEvents24h: totalEvents,
          errorCount24h: errorCount,
          errorRate24h: errorRate,
          p95LatencyMs,
          avgLatencyMs,
          openIncidentsCount: openIncidents.length,
        },
      });
    }

    return result.sort((a, b) => a.name.localeCompare(b.name));
  }

  async getServiceDetail(
    userId: string,
    projectId: string,
    serviceName: string,
  ): Promise<ServiceDetailDto> {
    await this.ensureProjectAccess(projectId, userId);
    const normalizedName = serviceName.toLowerCase().trim();

    let service = await this.serviceRepo.findServiceByName(projectId, normalizedName);
    if (service === null) {
      // Check if it exists as a telemetry source
      const distinct = await this.serviceRepo.listDistinctSources(projectId);
      if (distinct.includes(normalizedName)) {
        service = await this.serviceRepo.upsertService({
          projectId,
          name: normalizedName,
          displayName: formatServiceName(normalizedName),
          isAutoDiscovered: true,
          status: "discovered",
          language: guessLanguage(normalizedName),
          runtime: "docker",
          tier: "tier_2",
          tags: ["auto-discovered"],
          onboardingChecklist: defaultChecklist(),
        });
      } else {
        throw notFound(`Service "${serviceName}" not found`);
      }
    }

    const [metricSummary, traceSummary, incidents, errorGroups, vaultActivity] = await Promise.all([
      this.dashboardRepo.metricSummary(projectId, { since: new Date(Date.now() - 86_400_000) }),
      this.dashboardRepo.traceSummary(projectId, { since: new Date(Date.now() - 86_400_000) }),
      this.dashboardRepo.latestIncidents(projectId),
      this.dashboardRepo.errorGroups(projectId, { since: new Date(Date.now() - 86_400_000) }),
      this.dashboardRepo.latestVaultActivity(projectId),
    ]);

    const stats = metricSummary.services.find((s) => s.service.toLowerCase() === normalizedName);
    const serviceIncidents = incidents.filter((inc) =>
      inc.samples.some((sample) => sample.source.toLowerCase() === normalizedName),
    );
    const openIncidents = serviceIncidents.filter((inc) => inc.status !== "resolved");

    const totalEvents = stats?.events ?? 0;
    const errorCount = stats?.errors ?? 0;
    const errorRate = stats?.errorRate ?? 0;
    const avgLatencyMs = stats?.avgLatencyMs ?? null;
    const p95LatencyMs = metricSummary.p95LatencyMs ?? null;

    const health = calculateHealthScore({
      errorRate,
      openIncidents,
      p95LatencyMs,
      checklist: service.onboardingChecklist,
    });

    // Inbound and Outbound dependencies from traceSummary.serviceMap
    const inbound: ServiceDependencyEdge[] = [];
    const outbound: ServiceDependencyEdge[] = [];

    for (const edge of traceSummary.serviceMap) {
      if (edge.to.toLowerCase() === normalizedName && edge.from.toLowerCase() !== normalizedName) {
        inbound.push({
          service: edge.from,
          callCount: edge.spanCount,
          errorCount: edge.errorCount,
          avgLatencyMs: edge.avgDurationMs,
        });
      } else if (
        edge.from.toLowerCase() === normalizedName &&
        edge.to.toLowerCase() !== normalizedName
      ) {
        outbound.push({
          service: edge.to,
          callCount: edge.spanCount,
          errorCount: edge.errorCount,
          avgLatencyMs: edge.avgDurationMs,
        });
      }
    }

    // Filter error groups for this service
    const serviceErrors = errorGroups
      .filter((g) => g.source.toLowerCase() === normalizedName)
      .slice(0, 15)
      .map((g) => ({
        id: g.fingerprint,
        fingerprint: g.fingerprint,
        message: g.message,
        level: g.samples[0]?.level ?? "error",
        observedAt: g.lastSeenAt.toISOString(),
        count: g.count,
      }));

    return {
      ...service,
      health,
      stats: {
        totalEvents24h: totalEvents,
        errorCount24h: errorCount,
        errorRate24h: errorRate,
        p95LatencyMs,
        avgLatencyMs,
        openIncidentsCount: openIncidents.length,
      },
      dependencies: {
        inbound,
        outbound,
      },
      recentErrors: serviceErrors,
      recentIncidents: serviceIncidents.slice(0, 10).map((inc) => ({
        id: inc.id,
        title: inc.title,
        severity: inc.severity,
        status: inc.status,
        eventCount: inc.eventCount,
        createdAt: inc.createdAt.toISOString(),
      })),
      relatedSecretsCount: vaultActivity.filter((v) => v.status === "active").length,
    };
  }

  async upsertService(
    userId: string,
    projectId: string,
    input: CreateOrUpdateServiceInput,
  ): Promise<ServiceCatalogItemDto> {
    await this.ensureProjectAccess(projectId, userId);
    const service = await this.serviceRepo.upsertService(input);
    return this.getServiceDetail(userId, projectId, service.name);
  }

  async deleteService(userId: string, projectId: string, serviceName: string): Promise<boolean> {
    await this.ensureProjectAccess(projectId, userId);
    return this.serviceRepo.deleteService(projectId, serviceName);
  }

  private async ensureProjectAccess(projectId: string, userId: string): Promise<void> {
    const hasAccess = await this.projectAuth.canAccessProject(projectId, userId);
    if (!hasAccess) {
      throw forbidden("Project access required");
    }
  }
}

export function calculateHealthScore(input: {
  errorRate: number;
  openIncidents: DashboardIncident[];
  p95LatencyMs: number | null;
  checklist: Array<{ completed: boolean }>;
}): ServiceHealthScore {
  // 1. Error Penalty (max 40 pts)
  const errorPenalty = Math.min(40, Math.round(input.errorRate * 4));

  // 2. Incident Penalty (max 30 pts)
  let incidentPenalty = 0;
  for (const inc of input.openIncidents) {
    if (inc.severity === "critical") incidentPenalty += 30;
    else if (inc.severity === "high") incidentPenalty += 20;
    else if (inc.severity === "medium") incidentPenalty += 10;
    else incidentPenalty += 5;
  }
  incidentPenalty = Math.min(30, incidentPenalty);

  // 3. Latency Penalty (max 20 pts)
  let latencyPenalty = 0;
  if (input.p95LatencyMs !== null && input.p95LatencyMs > 500) {
    latencyPenalty = Math.min(20, Math.round((input.p95LatencyMs - 500) / 25));
  }

  // 4. Readiness score (max 10 pts)
  const totalItems = input.checklist.length || 1;
  const completedItems = input.checklist.filter((i) => i.completed).length;
  const readinessScore = Math.round((completedItems / totalItems) * 10);
  const checklistDeficit = 10 - readinessScore;

  const score = Math.max(
    0,
    Math.min(100, 100 - errorPenalty - incidentPenalty - latencyPenalty - checklistDeficit),
  );

  let status: ServiceHealthStatus = "healthy";
  if (score < 70) {
    status = "critical";
  } else if (score < 90) {
    status = "degraded";
  }

  return {
    score,
    status,
    errorPenalty,
    incidentPenalty,
    latencyPenalty,
    readinessScore,
  };
}

function formatServiceName(source: string): string {
  return source
    .split(/[-_]/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function guessLanguage(name: string): SafeServiceRecord["language"] {
  const lower = name.toLowerCase();
  if (lower.includes("node") || lower.includes("js") || lower.includes("api")) return "nodejs";
  if (lower.includes("py") || lower.includes("ml") || lower.includes("ai")) return "python";
  if (lower.includes("go") || lower.includes("worker")) return "go";
  if (lower.includes("java") || lower.includes("spring")) return "java";
  if (lower.includes("rs") || lower.includes("rust")) return "rust";
  return "nodejs";
}
