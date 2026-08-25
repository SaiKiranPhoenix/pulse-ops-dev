import { apiClient } from "@/lib/api-client";
import type { ApiSuccessResponse } from "@/types/api";

export type DashboardSummary = {
  readonly projectId: string;
  readonly totalEvents: number;
  readonly openIncidents: number;
};

export type DashboardEvent = {
  readonly id: string;
  readonly projectId: string;
  readonly type: "log" | "error" | "metric";
  readonly source: string;
  readonly level: string | null;
  readonly message: string | null;
  readonly name: string | null;
  readonly value: number | null;
  readonly unit: string | null;
  readonly fingerprint: string;
  readonly attributes: Record<string, unknown>;
  readonly observedAt: string;
  readonly receivedAt: string;
};

export type DashboardEventPage = {
  readonly events: DashboardEvent[];
  readonly nextCursor: string | null;
};

export type DashboardIncident = {
  readonly id: string;
  readonly projectId?: string;
  readonly fingerprint?: string;
  readonly title: string;
  readonly summary?: string | null;
  readonly severity: "low" | "medium" | "high" | "critical";
  readonly status: "open" | "acknowledged" | "resolved";
  readonly eventCount: number;
  readonly creationReason?: string;
  readonly acknowledgedAt?: string | null;
  readonly resolutionNote?: string | null;
  readonly samples?: IncidentEventSample[];
  readonly firstSeenAt?: string;
  readonly lastSeenAt: string;
  readonly resolvedAt?: string | null;
  readonly createdAt?: string;
  readonly updatedAt?: string;
};

export type IncidentEventSample = {
  readonly eventId: string;
  readonly telemetryMessageId: string;
  readonly source: string;
  readonly level: string | null;
  readonly message: string | null;
  readonly observedAt: string;
  readonly receivedAt: string;
};

export type WorkerHealth = {
  readonly workerId: string;
  readonly service: string;
  readonly status: "running";
  readonly queues: string[];
  readonly metrics: {
    readonly processed: number;
    readonly processedByType: {
      readonly log: number;
      readonly error: number;
      readonly metric: number;
    };
    readonly failed: number;
    readonly retries: number;
    readonly poisonMessages: number;
    readonly lastProcessedAt: string | null;
    readonly lastErrorAt: string | null;
    readonly lastErrorMessage: string | null;
  };
  readonly startedAt: string;
  readonly lastSeenAt: string;
  readonly ageSeconds: number;
};

export type WorkerStatusResponse = {
  readonly workers: WorkerHealth[];
};

export type QueueStatus = {
  readonly name: string;
  readonly status: "available" | "missing";
  readonly messageCount: number | null;
  readonly consumerCount: number | null;
  readonly health: "clear" | "backlog" | "blocked" | "missing";
  readonly backlogWarning: string | null;
};

export type QueueStatusResponse = {
  readonly queues: QueueStatus[];
};

export type DeadLetterMessage = {
  readonly id: string;
  readonly routingKey: string;
  readonly exchange: string;
  readonly redelivered: boolean;
  readonly contentType: string | undefined;
  readonly deadLetterReason: string | null;
  readonly originalExchange: string | null;
  readonly originalRoutingKey: string | null;
  readonly payload: unknown;
};

export type DeadLetterResponse = {
  readonly messages: DeadLetterMessage[];
};

export type DeadLetterReplayResponse = {
  readonly replay: {
    readonly replayed: number;
  };
};

export type RealtimeIncidentUpdate = {
  readonly messageId: string;
  readonly schemaVersion: 1;
  readonly projectId: string;
  readonly action: "opened" | "updated" | "acknowledged" | "resolved" | "reopened";
  readonly incident: DashboardIncident;
  readonly occurredAt: string;
};

export type RealtimeEventCreated = {
  readonly messageId: string;
  readonly schemaVersion: 1;
  readonly projectId: string;
  readonly event: DashboardEvent;
  readonly occurredAt: string;
};

export type DashboardAnalyticsOptions = {
  readonly environment?: string;
  readonly timeRange?: string;
};

export type IngestionStats = {
  readonly projectId: string;
  readonly environment: string | null;
  readonly timeRange: string;
  readonly acceptedEvents: number;
  readonly processedEvents: number;
  readonly rejectedEvents: number;
  readonly processingBacklog: number;
  readonly latestAcceptedAt: string | null;
  readonly latestProcessedAt: string | null;
  readonly rateLimit: {
    readonly limitPerMinute: number;
    readonly windowSeconds: number;
  };
};

export type ErrorGroup = {
  readonly fingerprint: string;
  readonly source: string;
  readonly message: string;
  readonly count: number;
  readonly firstSeenAt: string;
  readonly lastSeenAt: string;
  readonly samples: DashboardEvent[];
  readonly stack: string | null;
  readonly incident: DashboardIncident | null;
};

export type MetricSummary = {
  readonly projectId: string;
  readonly environment: string | null;
  readonly timeRange: string;
  readonly totalEvents: number;
  readonly logCount: number;
  readonly errorCount: number;
  readonly metricCount: number;
  readonly errorRate: number;
  readonly avgLatencyMs: number | null;
  readonly p95LatencyMs: number | null;
  readonly buckets: Array<{
    readonly label: string;
    readonly startedAt: string;
    readonly events: number;
    readonly logs: number;
    readonly errors: number;
    readonly metrics: number;
    readonly errorRate: number;
    readonly avgLatencyMs: number | null;
    readonly p95LatencyMs: number | null;
  }>;
  readonly services: Array<{
    readonly service: string;
    readonly events: number;
    readonly logs: number;
    readonly errors: number;
    readonly metrics: number;
    readonly errorRate: number;
    readonly avgLatencyMs: number | null;
  }>;
  readonly metricSamples: Array<{
    readonly id: string;
    readonly source: string;
    readonly name: string;
    readonly value: number;
    readonly unit: string | null;
    readonly observedAt: string;
  }>;
};

export type TraceSummary = {
  readonly projectId: string;
  readonly environment: string | null;
  readonly timeRange: string;
  readonly totalTraces: number;
  readonly totalSpans: number;
  readonly errorTraces: number;
  readonly slowTraces: number;
  readonly serviceCount: number;
  readonly slowThresholdMs: number;
  readonly traces: TraceGroup[];
  readonly endpoints: TraceEndpoint[];
  readonly serviceMap: TraceEdge[];
};

export type TraceGroup = {
  readonly traceId: string;
  readonly rootService: string;
  readonly startedAt: string;
  readonly endedAt: string;
  readonly durationMs: number;
  readonly spanCount: number;
  readonly errorCount: number;
  readonly slowSpanCount: number;
  readonly isSlow: boolean;
  readonly services: string[];
  readonly spans: TraceSpan[];
};

export type TraceSpan = {
  readonly id: string;
  readonly eventId: string;
  readonly traceId: string;
  readonly spanId: string;
  readonly parentSpanId: string | null;
  readonly service: string;
  readonly operation: string;
  readonly resource: string | null;
  readonly eventType: "log" | "error" | "metric";
  readonly level: string | null;
  readonly startedAt: string;
  readonly durationMs: number;
  readonly status: "ok" | "error";
};

export type TraceEndpoint = {
  readonly service: string;
  readonly operation: string;
  readonly spanCount: number;
  readonly errorCount: number;
  readonly slowSpanCount: number;
  readonly avgDurationMs: number;
  readonly p95DurationMs: number;
};

export type TraceEdge = {
  readonly from: string;
  readonly to: string;
  readonly spanCount: number;
  readonly errorCount: number;
  readonly avgDurationMs: number;
};

export async function getDashboardSummary(projectId: string): Promise<DashboardSummary> {
  const response = await apiClient.get<ApiSuccessResponse<{ readonly summary: DashboardSummary }>>(
    "/dashboard/summary",
    { params: { projectId } },
  );
  return response.data.data.summary;
}

export async function listDashboardEvents(projectId: string): Promise<DashboardEvent[]> {
  const page = await listDashboardEventPage(projectId);
  return page.events;
}

export async function listDashboardEventPage(
  projectId: string,
  options: {
    readonly cursor?: string | null;
    readonly limit?: number;
  } = {},
): Promise<DashboardEventPage> {
  const response = await apiClient.get<ApiSuccessResponse<DashboardEventPage>>(
    "/dashboard/events",
    {
      params: {
        projectId,
        ...(options.cursor === undefined || options.cursor === null
          ? {}
          : { cursor: options.cursor }),
        ...(options.limit === undefined ? {} : { limit: options.limit }),
      },
    },
  );
  return response.data.data;
}

export async function listDashboardIncidents(projectId: string): Promise<DashboardIncident[]> {
  const response = await apiClient.get<
    ApiSuccessResponse<{ readonly incidents: DashboardIncident[] }>
  >("/dashboard/incidents", { params: { projectId } });
  return response.data.data.incidents;
}

export async function getWorkerStatus(): Promise<WorkerStatusResponse> {
  const response =
    await apiClient.get<ApiSuccessResponse<WorkerStatusResponse>>("/dashboard/workers");
  return response.data.data;
}

export async function getQueueStatus(): Promise<QueueStatusResponse> {
  const response =
    await apiClient.get<ApiSuccessResponse<QueueStatusResponse>>("/dashboard/queues");
  return response.data.data;
}

export async function listDeadLetters(limit = 20): Promise<DeadLetterMessage[]> {
  const response = await apiClient.get<ApiSuccessResponse<DeadLetterResponse>>(
    "/dashboard/dead-letters",
    { params: { limit } },
  );
  return response.data.data.messages;
}

export async function replayDeadLetters(limit = 10): Promise<number> {
  const response = await apiClient.post<ApiSuccessResponse<DeadLetterReplayResponse>>(
    "/ops/dead-letters/replay",
    { limit },
  );
  return response.data.data.replay.replayed;
}

export async function getIngestionStats(
  projectId: string,
  options: DashboardAnalyticsOptions = {},
): Promise<IngestionStats> {
  const response = await apiClient.get<ApiSuccessResponse<{ readonly ingestion: IngestionStats }>>(
    "/dashboard/ingestion",
    {
      params: toAnalyticsParams(projectId, options),
    },
  );
  return response.data.data.ingestion;
}

export async function listErrorGroups(
  projectId: string,
  options: DashboardAnalyticsOptions = {},
): Promise<ErrorGroup[]> {
  const response = await apiClient.get<ApiSuccessResponse<{ readonly errorGroups: ErrorGroup[] }>>(
    "/dashboard/error-groups",
    {
      params: toAnalyticsParams(projectId, options),
    },
  );
  return response.data.data.errorGroups;
}

export async function getMetricSummary(
  projectId: string,
  options: DashboardAnalyticsOptions = {},
): Promise<MetricSummary> {
  const response = await apiClient.get<ApiSuccessResponse<{ readonly metrics: MetricSummary }>>(
    "/dashboard/metrics",
    {
      params: toAnalyticsParams(projectId, options),
    },
  );
  return response.data.data.metrics;
}

export async function getTraceSummary(
  projectId: string,
  options: DashboardAnalyticsOptions = {},
): Promise<TraceSummary> {
  const response = await apiClient.get<ApiSuccessResponse<{ readonly traces: TraceSummary }>>(
    "/dashboard/traces",
    {
      params: toAnalyticsParams(projectId, options),
    },
  );
  return response.data.data.traces;
}

function toAnalyticsParams(projectId: string, options: DashboardAnalyticsOptions) {
  return {
    projectId,
    ...(options.environment === undefined ? {} : { environment: options.environment }),
    ...(options.timeRange === undefined ? {} : { timeRange: options.timeRange }),
  };
}
