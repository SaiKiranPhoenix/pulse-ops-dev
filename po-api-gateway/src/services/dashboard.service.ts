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

export type DashboardIngestionStatsDto = Omit<
  DashboardIngestionStats,
  "latestAcceptedAt" | "latestProcessedAt"
> & {
  readonly projectId: string;
  readonly environment: string | null;
  readonly timeRange: string;
  readonly rateLimit: {
    readonly limitPerMinute: number;
    readonly windowSeconds: number;
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
  constructor(private readonly dashboard: DashboardRepository) {}

  async summary(projectId: string): Promise<DashboardSummaryDto> {
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
    projectId: string,
    options: DashboardEventPageOptions,
  ): Promise<DashboardEventPageDto> {
    const page = await this.dashboard.pagedEvents(projectId, options);
    return {
      events: page.events.map(toDashboardEventDto),
      nextCursor: page.nextCursor,
    };
  }

  async incidents(projectId: string): Promise<DashboardIncidentDto[]> {
    const incidents = await this.dashboard.latestIncidents(projectId);
    return incidents.map(toDashboardIncidentDto);
  }

  async vaultActivity(projectId: string): Promise<DashboardVaultActivityDto[]> {
    const activities = await this.dashboard.latestVaultActivity(projectId);
    return activities.map((activity) => ({
      ...activity,
      updatedAt: activity.updatedAt.toISOString(),
    }));
  }

  async ingestionStats(
    projectId: string,
    options: DashboardAnalyticsOptionsDto,
  ): Promise<DashboardIngestionStatsDto> {
    const normalizedOptions = toAnalyticsOptions(options);
    const stats = await this.dashboard.ingestionStats(projectId, normalizedOptions);

    return {
      ...stats,
      projectId,
      environment: options.environment ?? null,
      timeRange: options.timeRange ?? "1h",
      rateLimit: {
        limitPerMinute: 600,
        windowSeconds: 60,
      },
      latestAcceptedAt: stats.latestAcceptedAt?.toISOString() ?? null,
      latestProcessedAt: stats.latestProcessedAt?.toISOString() ?? null,
    };
  }

  async errorGroups(
    projectId: string,
    options: DashboardAnalyticsOptionsDto,
  ): Promise<DashboardErrorGroupDto[]> {
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
    projectId: string,
    options: DashboardAnalyticsOptionsDto,
  ): Promise<DashboardMetricSummaryDto> {
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
    projectId: string,
    options: DashboardAnalyticsOptionsDto,
  ): Promise<DashboardTraceSummaryDto> {
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
}

function toDashboardEventDto(event: DashboardEvent): DashboardEventDto {
  return {
    ...event,
    observedAt: event.observedAt.toISOString(),
    receivedAt: event.receivedAt.toISOString(),
  };
}

function toDashboardIncidentDto(incident: DashboardIncident): DashboardIncidentDto {
  return {
    ...incident,
    acknowledgedAt: incident.acknowledgedAt?.toISOString() ?? null,
    firstSeenAt: incident.firstSeenAt.toISOString(),
    lastSeenAt: incident.lastSeenAt.toISOString(),
    resolvedAt: incident.resolvedAt?.toISOString() ?? null,
    samples: incident.samples.map((sample) => ({
      ...sample,
      observedAt: sample.observedAt.toISOString(),
      receivedAt: sample.receivedAt.toISOString(),
    })),
    createdAt: incident.createdAt.toISOString(),
    updatedAt: incident.updatedAt.toISOString(),
  };
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
