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
  readonly status: "open" | "resolved";
  readonly eventCount: number;
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
}

export class MongoDashboardRepository implements DashboardRepository {
  async countEvents(projectId: string): Promise<number> {
    return DashboardEventModel.countDocuments({ projectId }).exec();
  }

  async countOpenIncidents(projectId: string): Promise<number> {
    return DashboardIncidentModel.countDocuments({ projectId, status: "open" }).exec();
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
