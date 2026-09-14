import { GATEWAY_LIMITS } from "../config/constants.js";
import mongoose, { type QueryFilter } from "mongoose";
import {
  DashboardIngestionAcceptanceModel,
  DashboardEventModel,
  DashboardIncidentModel,
  DashboardVaultSecretModel,
  type DashboardEventRecord,
  type DashboardEventDocument,
  type DashboardIncidentDocument,
  type DashboardVaultSecretDocument,
} from "../models/dashboard-read.model.js";

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
  readonly observedAt: Date;
  readonly receivedAt: Date;
};

export type DashboardAnalyticsOptions = {
  readonly environment?: string;
  readonly since?: Date;
};

export type DashboardEventPageOptions = {
  readonly cursor?: string;
  readonly limit: number;
};

export type DashboardEventPage = {
  readonly events: DashboardEvent[];
  readonly nextCursor: string | null;
};

export type DashboardIncident = {
  readonly id: string;
  readonly projectId: string;
  readonly fingerprint: string;
  readonly title: string;
  readonly summary: string | null;
  readonly severity: "low" | "medium" | "high" | "critical";
  readonly status: "open" | "acknowledged" | "resolved";
  readonly eventCount: number;
  readonly creationReason: string;
  readonly acknowledgedAt: Date | null;
  readonly resolutionNote: string | null;
  readonly samples: Array<{
    readonly eventId: string;
    readonly telemetryMessageId: string;
    readonly source: string;
    readonly level: string | null;
    readonly message: string | null;
    readonly observedAt: Date;
    readonly receivedAt: Date;
  }>;
  readonly firstSeenAt: Date;
  readonly lastSeenAt: Date;
  readonly resolvedAt: Date | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
};

export type DashboardVaultActivity = {
  readonly id: string;
  readonly environment: string;
  readonly key: string;
  readonly status: "active" | "deleted";
  readonly updatedAt: Date;
};

export type DashboardIngestionStats = {
  readonly acceptedEvents: number;
  readonly processedEvents: number;
  readonly rejectedEvents: number;
  readonly processingBacklog: number;
  readonly latestAcceptedAt: Date | null;
  readonly latestProcessedAt: Date | null;
};

export type DashboardErrorGroup = {
  readonly fingerprint: string;
  readonly source: string;
  readonly message: string;
  readonly count: number;
  readonly firstSeenAt: Date;
  readonly lastSeenAt: Date;
  readonly samples: DashboardEvent[];
  readonly stack: string | null;
  readonly incident: DashboardIncident | null;
};

export type DashboardMetricBucket = {
  readonly label: string;
  readonly startedAt: Date;
  readonly events: number;
  readonly logs: number;
  readonly errors: number;
  readonly metrics: number;
  readonly errorRate: number;
  readonly avgLatencyMs: number | null;
  readonly p95LatencyMs: number | null;
};

export type DashboardMetricService = {
  readonly service: string;
  readonly events: number;
  readonly logs: number;
  readonly errors: number;
  readonly metrics: number;
  readonly errorRate: number;
  readonly avgLatencyMs: number | null;
};

export type DashboardMetricSample = {
  readonly id: string;
  readonly source: string;
  readonly name: string;
  readonly value: number;
  readonly unit: string | null;
  readonly observedAt: Date;
};

export type DashboardMetricSummary = {
  readonly totalEvents: number;
  readonly logCount: number;
  readonly errorCount: number;
  readonly metricCount: number;
  readonly errorRate: number;
  readonly avgLatencyMs: number | null;
  readonly p95LatencyMs: number | null;
  readonly buckets: DashboardMetricBucket[];
  readonly services: DashboardMetricService[];
  readonly metricSamples: DashboardMetricSample[];
};

export type DashboardTraceSpan = {
  readonly id: string;
  readonly eventId: string;
  readonly traceId: string;
  readonly spanId: string;
  readonly parentSpanId: string | null;
  readonly service: string;
  readonly operation: string;
  readonly resource: string | null;
  readonly eventType: DashboardEvent["type"];
  readonly level: string | null;
  readonly startedAt: Date;
  readonly durationMs: number;
  readonly status: "ok" | "error";
};

export type DashboardTrace = {
  readonly traceId: string;
  readonly rootService: string;
  readonly startedAt: Date;
  readonly endedAt: Date;
  readonly durationMs: number;
  readonly spanCount: number;
  readonly errorCount: number;
  readonly slowSpanCount: number;
  readonly isSlow: boolean;
  readonly services: string[];
  readonly spans: DashboardTraceSpan[];
};

export type DashboardTraceEndpoint = {
  readonly service: string;
  readonly operation: string;
  readonly spanCount: number;
  readonly errorCount: number;
  readonly slowSpanCount: number;
  readonly avgDurationMs: number;
  readonly p95DurationMs: number;
};

export type DashboardTraceEdge = {
  readonly from: string;
  readonly to: string;
  readonly spanCount: number;
  readonly errorCount: number;
  readonly avgDurationMs: number;
};

export type DashboardTraceSummary = {
  readonly totalTraces: number;
  readonly totalSpans: number;
  readonly errorTraces: number;
  readonly slowTraces: number;
  readonly serviceCount: number;
  readonly slowThresholdMs: number;
  readonly traces: DashboardTrace[];
  readonly endpoints: DashboardTraceEndpoint[];
  readonly serviceMap: DashboardTraceEdge[];
};

export interface DashboardRepository {
  countEvents(projectId: string): Promise<number>;
  countOpenIncidents(projectId: string): Promise<number>;
  latestEvents(projectId: string): Promise<DashboardEvent[]>;
  pagedEvents(projectId: string, options: DashboardEventPageOptions): Promise<DashboardEventPage>;
  latestIncidents(projectId: string): Promise<DashboardIncident[]>;
  latestVaultActivity(projectId: string): Promise<DashboardVaultActivity[]>;
  ingestionStats(
    projectId: string,
    options: DashboardAnalyticsOptions,
  ): Promise<DashboardIngestionStats>;
  errorGroups(
    projectId: string,
    options: DashboardAnalyticsOptions,
  ): Promise<DashboardErrorGroup[]>;
  metricSummary(
    projectId: string,
    options: DashboardAnalyticsOptions,
  ): Promise<DashboardMetricSummary>;
  traceSummary(
    projectId: string,
    options: DashboardAnalyticsOptions,
  ): Promise<DashboardTraceSummary>;
}

export class MongoDashboardRepository implements DashboardRepository {
  async countEvents(projectId: string): Promise<number> {
    return DashboardEventModel.countDocuments({ projectId }).exec();
  }

  async countOpenIncidents(projectId: string): Promise<number> {
    return DashboardIncidentModel.countDocuments({
      projectId,
      status: { $in: ["open", "acknowledged"] },
    }).exec();
  }

  async latestEvents(projectId: string): Promise<DashboardEvent[]> {
    const page = await this.pagedEvents(projectId, {
      limit: GATEWAY_LIMITS.dashboardLimit,
    });
    return page.events;
  }

  async pagedEvents(
    projectId: string,
    options: DashboardEventPageOptions,
  ): Promise<DashboardEventPage> {
    const limit = Math.min(Math.max(options.limit, 1), GATEWAY_LIMITS.dashboardLimit);
    const cursor = options.cursor === undefined ? null : decodeEventCursor(options.cursor);
    const query =
      cursor === null
        ? { projectId }
        : {
            projectId,
            $or: [
              { receivedAt: { $lt: cursor.receivedAt } },
              {
                receivedAt: cursor.receivedAt,
                _id: { $lt: new mongoose.Types.ObjectId(cursor.id) },
              },
            ],
          };

    const events = await DashboardEventModel.find(query)
      .sort({ receivedAt: -1, _id: -1 })
      .limit(limit + 1)
      .exec();

    const visibleEvents = events.slice(0, limit).map(toDashboardEvent);
    const nextEvent = events.length > limit ? visibleEvents.at(-1) : undefined;

    return {
      events: visibleEvents,
      nextCursor: nextEvent === undefined ? null : encodeEventCursor(nextEvent),
    };
  }

  async latestIncidents(projectId: string): Promise<DashboardIncident[]> {
    const incidents = await DashboardIncidentModel.find({ projectId })
      .sort({ lastSeenAt: -1 })
      .limit(GATEWAY_LIMITS.dashboardLimit)
      .exec();

    return incidents.map(toDashboardIncident);
  }

  async latestVaultActivity(projectId: string): Promise<DashboardVaultActivity[]> {
    const secrets = await DashboardVaultSecretModel.find({ projectId })
      .sort({ updatedAt: -1 })
      .limit(GATEWAY_LIMITS.dashboardLimit)
      .exec();

    return secrets.map(toVaultActivity);
  }

  async ingestionStats(
    projectId: string,
    options: DashboardAnalyticsOptions,
  ): Promise<DashboardIngestionStats> {
    const baseQuery = createEventQuery(projectId, options);
    const acceptanceQuery = {
      projectId,
      ...(options.since === undefined ? {} : { createdAt: { $gte: options.since } }),
    };

    const [acceptedEvents, processedEvents, latestAccepted, latestProcessed] = await Promise.all([
      DashboardIngestionAcceptanceModel.countDocuments(acceptanceQuery).exec(),
      DashboardEventModel.countDocuments(baseQuery).exec(),
      DashboardIngestionAcceptanceModel.findOne(acceptanceQuery).sort({ createdAt: -1 }).exec(),
      DashboardEventModel.findOne(baseQuery).sort({ receivedAt: -1 }).exec(),
    ]);

    return {
      acceptedEvents,
      processedEvents,
      rejectedEvents: 0,
      processingBacklog: Math.max(acceptedEvents - processedEvents, 0),
      latestAcceptedAt: latestAccepted?.createdAt ?? null,
      latestProcessedAt: latestProcessed?.receivedAt ?? null,
    };
  }

  async errorGroups(
    projectId: string,
    options: DashboardAnalyticsOptions,
  ): Promise<DashboardErrorGroup[]> {
    const query: QueryFilter<DashboardEventRecord> = {
      ...createEventQuery(projectId, options),
      type: "error",
    };
    const [events, incidents] = await Promise.all([
      DashboardEventModel.find(query).sort({ receivedAt: -1 }).limit(500).exec(),
      DashboardIncidentModel.find({ projectId }).sort({ lastSeenAt: -1 }).limit(200).exec(),
    ]);
    const incidentByFingerprint = new Map(
      incidents.map((incident) => [incident.fingerprint, toDashboardIncident(incident)]),
    );
    const grouped = new Map<string, DashboardEvent[]>();

    for (const event of events.map(toDashboardEvent)) {
      const samples = grouped.get(event.fingerprint) ?? [];
      samples.push(event);
      grouped.set(event.fingerprint, samples);
    }

    return [...grouped.entries()]
      .map(([fingerprint, samples]) => {
        const sortedSamples = samples
          .slice()
          .sort((left, right) => right.receivedAt.getTime() - left.receivedAt.getTime());
        const firstSeenAt = samples.reduce(
          (oldest, sample) => (sample.receivedAt < oldest ? sample.receivedAt : oldest),
          samples[0]?.receivedAt ?? new Date(),
        );
        const lastSeenAt = sortedSamples[0]?.receivedAt ?? new Date();
        const newestSample = sortedSamples[0];

        return {
          fingerprint,
          source: newestSample?.source ?? "unknown",
          message: newestSample?.message ?? newestSample?.name ?? fingerprint,
          count: samples.length,
          firstSeenAt,
          lastSeenAt,
          samples: sortedSamples.slice(0, 8),
          stack: newestSample === undefined ? null : readStack(newestSample.attributes),
          incident: incidentByFingerprint.get(fingerprint) ?? null,
        };
      })
      .sort((left, right) => right.lastSeenAt.getTime() - left.lastSeenAt.getTime());
  }

  async metricSummary(
    projectId: string,
    options: DashboardAnalyticsOptions,
  ): Promise<DashboardMetricSummary> {
    const events = (
      await DashboardEventModel.find(createEventQuery(projectId, options))
        .sort({ receivedAt: 1 })
        .limit(1_500)
        .exec()
    ).map(toDashboardEvent);

    return buildMetricSummary(events);
  }

  async traceSummary(
    projectId: string,
    options: DashboardAnalyticsOptions,
  ): Promise<DashboardTraceSummary> {
    const events = (
      await DashboardEventModel.find({
        ...createEventQuery(projectId, options),
        "attributes.traceId": { $type: "string" },
        "attributes.spanId": { $type: "string" },
      })
        .sort({ observedAt: 1, receivedAt: 1 })
        .limit(2_000)
        .exec()
    ).map(toDashboardEvent);

    return buildTraceSummary(events);
  }
}

function toDashboardEvent(event: DashboardEventDocument): DashboardEvent {
  return {
    id: event.id,
    projectId: event.projectId,
    type: event.type,
    source: event.source,
    level: event.level,
    message: event.message,
    name: event.name,
    value: event.value,
    unit: event.unit,
    fingerprint: event.fingerprint,
    attributes: event.attributes ?? {},
    observedAt: event.observedAt,
    receivedAt: event.receivedAt,
  };
}

function encodeEventCursor(event: DashboardEvent): string {
  return Buffer.from(
    JSON.stringify({
      id: event.id,
      receivedAt: event.receivedAt.toISOString(),
    }),
  ).toString("base64url");
}

function decodeEventCursor(
  cursor: string,
): { readonly id: string; readonly receivedAt: Date } | null {
  try {
    const parsed = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8")) as {
      readonly id?: unknown;
      readonly receivedAt?: unknown;
    };

    if (
      typeof parsed.id !== "string" ||
      !mongoose.Types.ObjectId.isValid(parsed.id) ||
      typeof parsed.receivedAt !== "string"
    ) {
      return null;
    }

    const receivedAt = new Date(parsed.receivedAt);

    if (Number.isNaN(receivedAt.getTime())) {
      return null;
    }

    return { id: parsed.id, receivedAt };
  } catch {
    return null;
  }
}

function toDashboardIncident(incident: DashboardIncidentDocument): DashboardIncident {
  return {
    id: incident.id,
    projectId: incident.projectId,
    fingerprint: incident.fingerprint,
    title: incident.title,
    summary: incident.summary,
    severity: incident.severity,
    status: incident.status,
    eventCount: incident.eventCount,
    creationReason: incident.creationReason ?? "Repeated error telemetry matched by fingerprint",
    acknowledgedAt: incident.acknowledgedAt ?? null,
    resolutionNote: incident.resolutionNote ?? null,
    samples: (incident.samples ?? []).map((sample) => ({
      eventId: sample.eventId,
      telemetryMessageId: sample.telemetryMessageId,
      source: sample.source,
      level: sample.level,
      message: sample.message,
      observedAt: sample.observedAt,
      receivedAt: sample.receivedAt,
    })),
    firstSeenAt: incident.firstSeenAt,
    lastSeenAt: incident.lastSeenAt,
    resolvedAt: incident.resolvedAt,
    createdAt: incident.createdAt,
    updatedAt: incident.updatedAt,
  };
}

function toVaultActivity(secret: DashboardVaultSecretDocument): DashboardVaultActivity {
  return {
    id: secret.id,
    environment: secret.environment,
    key: secret.key,
    status: secret.status,
    updatedAt: secret.updatedAt,
  };
}

function createEventQuery(
  projectId: string,
  options: DashboardAnalyticsOptions,
): Record<string, unknown> {
  return {
    projectId,
    ...(options.environment === undefined ? {} : { "attributes.environment": options.environment }),
    ...(options.since === undefined ? {} : { receivedAt: { $gte: options.since } }),
  };
}

function readStack(attributes: Record<string, unknown>): string | null {
  const stack = attributes.stack;
  return typeof stack === "string" && stack.trim().length > 0 ? stack : null;
}

function buildMetricSummary(events: DashboardEvent[]): DashboardMetricSummary {
  const logCount = events.filter((event) => event.type === "log").length;
  const errorCount = events.filter((event) => event.type === "error").length;
  const metricEvents = events.filter(
    (event): event is DashboardEvent & { readonly value: number } =>
      event.type === "metric" && event.value !== null,
  );
  const latencyValues = metricEvents
    .filter((event) => isLatencyMetric(event))
    .map((event) => event.value);

  return {
    totalEvents: events.length,
    logCount,
    errorCount,
    metricCount: metricEvents.length,
    errorRate: rate(errorCount, events.length),
    avgLatencyMs: average(latencyValues),
    p95LatencyMs: percentile(latencyValues, 95),
    buckets: buildMetricBuckets(events),
    services: buildServiceMetrics(events),
    metricSamples: metricEvents.slice(-80).map((event) => ({
      id: event.id,
      source: event.source,
      name: event.name ?? event.fingerprint,
      value: event.value,
      unit: event.unit,
      observedAt: event.observedAt,
    })),
  };
}

function buildMetricBuckets(events: DashboardEvent[]): DashboardMetricBucket[] {
  const buckets = new Map<
    number,
    { logs: number; errors: number; metrics: number; latencyValues: number[] }
  >();

  for (const event of events) {
    const startedAt = floorToMinute(event.receivedAt).getTime();
    const bucket = buckets.get(startedAt) ?? {
      logs: 0,
      errors: 0,
      metrics: 0,
      latencyValues: [],
    };

    if (event.type === "log") {
      bucket.logs += 1;
    } else if (event.type === "error") {
      bucket.errors += 1;
    } else {
      bucket.metrics += 1;
      if (event.value !== null && isLatencyMetric(event)) {
        bucket.latencyValues.push(event.value);
      }
    }

    buckets.set(startedAt, bucket);
  }

  return [...buckets.entries()].slice(-60).map(([startedAt, bucket]) => {
    const eventsCount = bucket.logs + bucket.errors + bucket.metrics;

    return {
      label: new Date(startedAt).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      }),
      startedAt: new Date(startedAt),
      events: eventsCount,
      logs: bucket.logs,
      errors: bucket.errors,
      metrics: bucket.metrics,
      errorRate: rate(bucket.errors, eventsCount),
      avgLatencyMs: average(bucket.latencyValues),
      p95LatencyMs: percentile(bucket.latencyValues, 95),
    };
  });
}

function buildServiceMetrics(events: DashboardEvent[]): DashboardMetricService[] {
  const services = new Map<
    string,
    { logs: number; errors: number; metrics: number; latencyValues: number[] }
  >();

  for (const event of events) {
    const service = services.get(event.source) ?? {
      logs: 0,
      errors: 0,
      metrics: 0,
      latencyValues: [],
    };

    if (event.type === "log") {
      service.logs += 1;
    } else if (event.type === "error") {
      service.errors += 1;
    } else {
      service.metrics += 1;
      if (event.value !== null && isLatencyMetric(event)) {
        service.latencyValues.push(event.value);
      }
    }

    services.set(event.source, service);
  }

  return [...services.entries()]
    .map(([service, stats]) => {
      const eventsCount = stats.logs + stats.errors + stats.metrics;

      return {
        service,
        events: eventsCount,
        logs: stats.logs,
        errors: stats.errors,
        metrics: stats.metrics,
        errorRate: rate(stats.errors, eventsCount),
        avgLatencyMs: average(stats.latencyValues),
      };
    })
    .sort((left, right) => right.events - left.events)
    .slice(0, 20);
}

function isLatencyMetric(event: DashboardEvent): boolean {
  const name = event.name?.toLowerCase() ?? "";
  return event.unit === "ms" || /latency|duration|response[_-]?time/.test(name);
}

function floorToMinute(value: Date): Date {
  const next = new Date(value);
  next.setSeconds(0, 0);
  return next;
}

function rate(count: number, total: number): number {
  return total === 0 ? 0 : Number(((count / total) * 100).toFixed(2));
}

function average(values: readonly number[]): number | null {
  if (values.length === 0) {
    return null;
  }

  return Number((values.reduce((total, value) => total + value, 0) / values.length).toFixed(2));
}

function percentile(values: readonly number[], percentileValue: number): number | null {
  if (values.length === 0) {
    return null;
  }

  const sorted = [...values].sort((left, right) => left - right);
  const index = Math.min(
    sorted.length - 1,
    Math.max(0, Math.ceil((percentileValue / 100) * sorted.length) - 1),
  );
  const value = sorted[index];
  return value === undefined ? null : Number(value.toFixed(2));
}

const slowTraceThresholdMs = 500;
const slowSpanThresholdMs = 250;

function buildTraceSummary(events: DashboardEvent[]): DashboardTraceSummary {
  const spans = events.map(toTraceSpan).filter((span): span is DashboardTraceSpan => span !== null);
  const tracesById = groupBy(spans, (span) => span.traceId);
  const traces = [...tracesById.entries()]
    .map(([traceId, traceSpans]) => toTrace(traceId, traceSpans))
    .sort((left, right) => right.startedAt.getTime() - left.startedAt.getTime())
    .slice(0, 100);
  const serviceNames = new Set(spans.map((span) => span.service));

  return {
    totalTraces: traces.length,
    totalSpans: spans.length,
    errorTraces: traces.filter((trace) => trace.errorCount > 0).length,
    slowTraces: traces.filter((trace) => trace.isSlow).length,
    serviceCount: serviceNames.size,
    slowThresholdMs: slowTraceThresholdMs,
    traces,
    endpoints: buildTraceEndpoints(spans),
    serviceMap: buildTraceServiceMap(spans),
  };
}

function toTrace(traceId: string, spans: DashboardTraceSpan[]): DashboardTrace {
  const sortedSpans = spans
    .slice()
    .sort((left, right) => left.startedAt.getTime() - right.startedAt.getTime());
  const startedAt = sortedSpans[0]?.startedAt ?? new Date();
  const endedAt = sortedSpans.reduce(
    (latest, span) =>
      new Date(Math.max(latest.getTime(), span.startedAt.getTime() + span.durationMs)),
    startedAt,
  );
  const durationMs = Math.max(1, endedAt.getTime() - startedAt.getTime());
  const rootSpan = sortedSpans.find((span) => span.parentSpanId === null) ?? sortedSpans[0] ?? null;

  return {
    traceId,
    rootService: rootSpan?.service ?? "unknown",
    startedAt,
    endedAt,
    durationMs,
    spanCount: sortedSpans.length,
    errorCount: sortedSpans.filter((span) => span.status === "error").length,
    slowSpanCount: sortedSpans.filter((span) => span.durationMs >= slowSpanThresholdMs).length,
    isSlow: durationMs >= slowTraceThresholdMs,
    services: [...new Set(sortedSpans.map((span) => span.service))],
    spans: sortedSpans,
  };
}

function toTraceSpan(event: DashboardEvent): DashboardTraceSpan | null {
  const traceId = readStringAttribute(event.attributes, "traceId");
  const spanId = readStringAttribute(event.attributes, "spanId");

  if (traceId === null || spanId === null) {
    return null;
  }

  return {
    id: `${event.id}:${spanId}`,
    eventId: event.id,
    traceId,
    spanId,
    parentSpanId: readStringAttribute(event.attributes, "parentSpanId"),
    service: event.source,
    operation:
      readStringAttribute(event.attributes, "operation") ??
      event.message ??
      event.name ??
      event.fingerprint,
    resource: readStringAttribute(event.attributes, "resource"),
    eventType: event.type,
    level: event.level,
    startedAt: event.observedAt,
    durationMs: Math.max(
      1,
      readNumberAttribute(event.attributes, "durationMs") ?? event.value ?? 1,
    ),
    status: event.type === "error" || event.level === "error" ? "error" : "ok",
  };
}

function buildTraceEndpoints(spans: DashboardTraceSpan[]): DashboardTraceEndpoint[] {
  return [...groupBy(spans, (span) => `${span.service}\u0000${span.operation}`).entries()]
    .map(([key, groupedSpans]) => {
      const [service = "unknown", operation = "unknown"] = key.split("\u0000");
      const durations = groupedSpans.map((span) => span.durationMs);

      return {
        service,
        operation,
        spanCount: groupedSpans.length,
        errorCount: groupedSpans.filter((span) => span.status === "error").length,
        slowSpanCount: groupedSpans.filter((span) => span.durationMs >= slowSpanThresholdMs).length,
        avgDurationMs: average(durations) ?? 0,
        p95DurationMs: percentile(durations, 95) ?? 0,
      };
    })
    .sort((left, right) => right.p95DurationMs - left.p95DurationMs)
    .slice(0, 20);
}

function buildTraceServiceMap(spans: DashboardTraceSpan[]): DashboardTraceEdge[] {
  const spansByTrace = groupBy(spans, (span) => span.traceId);
  const edges = new Map<string, { count: number; errors: number; durations: number[] }>();

  for (const traceSpans of spansByTrace.values()) {
    const bySpanId = new Map(traceSpans.map((span) => [span.spanId, span]));

    for (const span of traceSpans) {
      if (span.parentSpanId === null) {
        continue;
      }

      const parent = bySpanId.get(span.parentSpanId);

      if (parent === undefined || parent.service === span.service) {
        continue;
      }

      const key = `${parent.service}\u0000${span.service}`;
      const edge = edges.get(key) ?? { count: 0, errors: 0, durations: [] };
      edge.count += 1;
      edge.errors += span.status === "error" ? 1 : 0;
      edge.durations.push(span.durationMs);
      edges.set(key, edge);
    }
  }

  return [...edges.entries()]
    .map(([key, edge]) => {
      const [from = "unknown", to = "unknown"] = key.split("\u0000");

      return {
        from,
        to,
        spanCount: edge.count,
        errorCount: edge.errors,
        avgDurationMs: average(edge.durations) ?? 0,
      };
    })
    .sort((left, right) => right.spanCount - left.spanCount)
    .slice(0, 30);
}

function readStringAttribute(attributes: Record<string, unknown>, key: string): string | null {
  const value = attributes[key];
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}

function readNumberAttribute(attributes: Record<string, unknown>, key: string): number | null {
  const value = attributes[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function groupBy<TValue>(
  values: readonly TValue[],
  keyForValue: (value: TValue) => string,
): Map<string, TValue[]> {
  const grouped = new Map<string, TValue[]>();

  for (const value of values) {
    const key = keyForValue(value);
    const group = grouped.get(key) ?? [];
    group.push(value);
    grouped.set(key, group);
  }

  return grouped;
}
