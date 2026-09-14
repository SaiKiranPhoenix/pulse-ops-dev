import type {
  DashboardEvent,
  DashboardEventPageOptions,
  DashboardErrorGroup,
  DashboardIngestionStats,
  DashboardIncident,
  DashboardMetricSummary,
  DashboardRepository,
  DashboardTraceSummary,
  DashboardVaultActivity,
} from "../repositories/dashboard.repository.js";
import type {
  DashboardRateLimitRepository,
  DashboardRateLimitUsage,
} from "../repositories/ingestion-rate-limit.repository.js";
import { forbidden } from "@pulseops/shared";
import type { ProjectAuthorizationRepository } from "../repositories/project-authorization.repository.js";

export type DashboardSummaryDto = {
  readonly projectId: string;
  readonly totalEvents: number;
  readonly openIncidents: number;
};

export type DashboardEventDto = Omit<DashboardEvent, "observedAt" | "receivedAt"> & {
  readonly observedAt: string;
  readonly receivedAt: string;
};

export type DashboardEventPageDto = {
  readonly events: DashboardEventDto[];
  readonly nextCursor: string | null;
};

export type DashboardIncidentDto = Omit<
  DashboardIncident,
  | "acknowledgedAt"
  | "createdAt"
  | "firstSeenAt"
  | "lastSeenAt"
  | "resolvedAt"
  | "samples"
  | "updatedAt"
> & {
  readonly acknowledgedAt: string | null;
  readonly firstSeenAt: string;
  readonly lastSeenAt: string;
  readonly resolvedAt: string | null;
  readonly samples: Array<
    Omit<DashboardIncident["samples"][number], "observedAt" | "receivedAt"> & {
      readonly observedAt: string;
      readonly receivedAt: string;
    }
  >;
  readonly createdAt: string;
  readonly updatedAt: string;
};

export type DashboardVaultActivityDto = Omit<DashboardVaultActivity, "updatedAt"> & {
  readonly updatedAt: string;
};

export type DashboardAnalyticsOptionsDto = {
  readonly environment?: string;
  readonly timeRange?: string;
};

export type DashboardRateLimitFallback = {
  readonly limitPerMinute: number;
  readonly windowSeconds: number;
};

export type DashboardIngestionStatsDto = Omit<
  DashboardIngestionStats,
  "latestAcceptedAt" | "latestProcessedAt"
> & {
  readonly projectId: string;
  readonly environment: string | null;
  readonly timeRange: string;
  readonly rateLimit: {
    readonly status: "available" | "unavailable";
    readonly limitPerMinute: number;
    readonly windowSeconds: number;
    readonly currentUsage: number | null;
    readonly remaining: number | null;
    readonly retryAfterSeconds: number | null;
    readonly resetsAt: string | null;
  };
  readonly latestAcceptedAt: string | null;
  readonly latestProcessedAt: string | null;
};

export type DashboardErrorGroupDto = Omit<
  DashboardErrorGroup,
  "firstSeenAt" | "lastSeenAt" | "samples" | "incident"
> & {
  readonly firstSeenAt: string;
  readonly lastSeenAt: string;
  readonly samples: DashboardEventDto[];
  readonly incident: DashboardIncidentDto | null;
};

export type DashboardMetricSummaryDto = Omit<
  DashboardMetricSummary,
  "buckets" | "metricSamples"
> & {
  readonly projectId: string;
  readonly environment: string | null;
  readonly timeRange: string;
  readonly buckets: Array<
    Omit<DashboardMetricSummary["buckets"][number], "startedAt"> & {
      readonly startedAt: string;
    }
  >;
  readonly metricSamples: Array<
    Omit<DashboardMetricSummary["metricSamples"][number], "observedAt"> & {
      readonly observedAt: string;
    }
  >;
};

export type DashboardTraceSummaryDto = Omit<
  DashboardTraceSummary,
  "traces" | "endpoints" | "serviceMap"
> & {
  readonly projectId: string;
  readonly environment: string | null;
  readonly timeRange: string;
  readonly traces: Array<
    Omit<DashboardTraceSummary["traces"][number], "startedAt" | "endedAt" | "spans"> & {
      readonly startedAt: string;
      readonly endedAt: string;
      readonly spans: Array<
        Omit<DashboardTraceSummary["traces"][number]["spans"][number], "startedAt"> & {
          readonly startedAt: string;
        }
      >;
    }
  >;
  readonly endpoints: DashboardTraceSummary["endpoints"];
  readonly serviceMap: DashboardTraceSummary["serviceMap"];
};

export class DashboardService {
  constructor(
    private readonly dashboard: DashboardRepository,
    private readonly projects: ProjectAuthorizationRepository,
    private readonly rateLimits?: DashboardRateLimitRepository,
    private readonly rateLimitFallback: DashboardRateLimitFallback = {
      limitPerMinute: 600,
      windowSeconds: 60,
    },
  ) {}

  async summary(userId: string, projectId: string): Promise<DashboardSummaryDto> {
    await this.ensureProjectAccess(projectId, userId);
    const [totalEvents, openIncidents] = await Promise.all([
      this.dashboard.countEvents(projectId),
      this.dashboard.countOpenIncidents(projectId),
    ]);

    return {
      projectId,
      totalEvents,
      openIncidents,
    };
  }

  async events(
    userId: string,
    projectId: string,
    options: DashboardEventPageOptions,
  ): Promise<DashboardEventPageDto> {
    await this.ensureProjectAccess(projectId, userId);
    const page = await this.dashboard.pagedEvents(projectId, options);
    return {
      events: page.events.map(toDashboardEventDto),
      nextCursor: page.nextCursor,
    };
  }

  async incidents(userId: string, projectId: string): Promise<DashboardIncidentDto[]> {
    await this.ensureProjectAccess(projectId, userId);
    const incidents = await this.dashboard.latestIncidents(projectId);
    return incidents.map(toDashboardIncidentDto);
  }

  async vaultActivity(userId: string, projectId: string): Promise<DashboardVaultActivityDto[]> {
    await this.ensureProjectAccess(projectId, userId);
    const activities = await this.dashboard.latestVaultActivity(projectId);
    return activities.map((activity) => ({
      ...activity,
      updatedAt: activity.updatedAt.toISOString(),
    }));
  }

  async ingestionStats(
    userId: string,
    projectId: string,
    options: DashboardAnalyticsOptionsDto,
  ): Promise<DashboardIngestionStatsDto> {
    await this.ensureProjectAccess(projectId, userId);
    const normalizedOptions = toAnalyticsOptions(options);
    const stats = await this.dashboard.ingestionStats(projectId, normalizedOptions);
    const rateLimit = await this.rateLimitSnapshot(projectId);

    return {
      ...stats,
      projectId,
      environment: options.environment ?? null,
      timeRange: options.timeRange ?? "1h",
      rateLimit,
      latestAcceptedAt: stats.latestAcceptedAt?.toISOString() ?? null,
      latestProcessedAt: stats.latestProcessedAt?.toISOString() ?? null,
    };
  }

  async errorGroups(
    userId: string,
    projectId: string,
    options: DashboardAnalyticsOptionsDto,
  ): Promise<DashboardErrorGroupDto[]> {
    await this.ensureProjectAccess(projectId, userId);
    const groups = await this.dashboard.errorGroups(projectId, toAnalyticsOptions(options));
    return groups.map((group) => ({
      ...group,
      firstSeenAt: group.firstSeenAt.toISOString(),
      lastSeenAt: group.lastSeenAt.toISOString(),
      samples: group.samples.map(toDashboardEventDto),
      incident: group.incident === null ? null : toDashboardIncidentDto(group.incident),
    }));
  }

  async metricSummary(
    userId: string,
    projectId: string,
    options: DashboardAnalyticsOptionsDto,
  ): Promise<DashboardMetricSummaryDto> {
    await this.ensureProjectAccess(projectId, userId);
    const summary = await this.dashboard.metricSummary(projectId, toAnalyticsOptions(options));

    return {
      ...summary,
      projectId,
      environment: options.environment ?? null,
      timeRange: options.timeRange ?? "1h",
      buckets: summary.buckets.map((bucket) => ({
        ...bucket,
        startedAt: bucket.startedAt.toISOString(),
      })),
      metricSamples: summary.metricSamples.map((sample) => ({
        ...sample,
        observedAt: sample.observedAt.toISOString(),
      })),
    };
  }

  async traceSummary(
    userId: string,
    projectId: string,
    options: DashboardAnalyticsOptionsDto,
  ): Promise<DashboardTraceSummaryDto> {
    await this.ensureProjectAccess(projectId, userId);
    const summary = await this.dashboard.traceSummary(projectId, toAnalyticsOptions(options));

    return {
      ...summary,
      projectId,
      environment: options.environment ?? null,
      timeRange: options.timeRange ?? "1h",
      traces: summary.traces.map((trace) => ({
        ...trace,
        startedAt: trace.startedAt.toISOString(),
        endedAt: trace.endedAt.toISOString(),
        spans: trace.spans.map((span) => ({
          ...span,
          startedAt: span.startedAt.toISOString(),
        })),
      })),
    };
  }

  private async rateLimitSnapshot(
    projectId: string,
  ): Promise<DashboardIngestionStatsDto["rateLimit"]> {
    try {
      const snapshot = await this.rateLimits?.snapshot(projectId);

      if (snapshot !== undefined) {
        return toRateLimitDto(snapshot);
      }
    } catch {
      return unavailableRateLimit(this.rateLimitFallback);
    }

    return unavailableRateLimit(this.rateLimitFallback);
  }

  private async ensureProjectAccess(projectId: string, userId: string): Promise<void> {
    if (!(await this.projects.canAccessProject(projectId, userId))) {
      throw forbidden("Project access denied");
    }
  }
}

function toRateLimitDto(
  snapshot: DashboardRateLimitUsage,
): DashboardIngestionStatsDto["rateLimit"] {
  return {
    ...snapshot,
    resetsAt: snapshot.resetsAt.toISOString(),
  };
}

function unavailableRateLimit(
  fallback: DashboardRateLimitFallback,
): DashboardIngestionStatsDto["rateLimit"] {
  return {
    status: "unavailable",
    limitPerMinute: fallback.limitPerMinute,
    windowSeconds: fallback.windowSeconds,
    currentUsage: null,
    remaining: null,
    retryAfterSeconds: null,
    resetsAt: null,
  };
}

function toDashboardEventDto(event: DashboardEvent): DashboardEventDto {
  return {
    ...event,
    observedAt: event.observedAt.toISOString(),
    receivedAt: event.receivedAt.toISOString(),
  };
}

function toDashboardIncidentDto(incident: DashboardIncident): DashboardIncidentDto {
  const firstSeenAt = requiredDateIso(incident.firstSeenAt, incident.lastSeenAt);
  const lastSeenAt = requiredDateIso(incident.lastSeenAt, incident.firstSeenAt);

  return {
    ...incident,
    acknowledgedAt: incident.acknowledgedAt?.toISOString() ?? null,
    firstSeenAt,
    lastSeenAt,
    resolvedAt: incident.resolvedAt?.toISOString() ?? null,
    samples: incident.samples.map((sample) => ({
      ...sample,
      observedAt: sample.observedAt.toISOString(),
      receivedAt: sample.receivedAt.toISOString(),
    })),
    createdAt: requiredDateIso(incident.createdAt, incident.firstSeenAt, incident.lastSeenAt),
    updatedAt: requiredDateIso(incident.updatedAt, incident.lastSeenAt, incident.firstSeenAt),
  };
}

function requiredDateIso(...values: Array<Date | null | undefined>): string {
  const date = values.find((value) => value instanceof Date && !Number.isNaN(value.getTime()));
  return (date ?? new Date(0)).toISOString();
}

function toAnalyticsOptions(options: DashboardAnalyticsOptionsDto) {
  return {
    ...(options.environment === undefined ? {} : { environment: options.environment }),
    since: toSinceDate(options.timeRange ?? "1h"),
  };
}

function toSinceDate(timeRange: string): Date {
  const now = Date.now();
  const durationMsByRange: Record<string, number> = {
    "15m": 15 * 60_000,
    "1h": 60 * 60_000,
    "6h": 6 * 60 * 60_000,
    "24h": 24 * 60 * 60_000,
    "7d": 7 * 24 * 60 * 60_000,
  };

  const fallbackDurationMs = 60 * 60_000;
  return new Date(now - (durationMsByRange[timeRange] ?? fallbackDurationMs));
}
