import type {
  CardinalityGuardrailStatus,
  CreateMetricDefinitionInput,
  MetricDefinition,
  MetricQueryInput,
  MetricTimeSeriesResult,
  ServiceMetricSummary,
  UpdateMetricDefinitionInput,
} from "@pulseops/shared";
import { MetricsRollupEngine, type RawMetricSample } from "../services/metrics-rollup.engine.js";

export class MetricsPlatformRepository {
  private readonly definitionsStore = new Map<string, MetricDefinition>();
  private readonly samplesStore = new Map<string, RawMetricSample[]>();

  constructor() {
    this.seedDefaultMetrics();
  }

  private seedDefaultMetrics(): void {
    const defaultMetrics: Array<Omit<MetricDefinition, "createdAt" | "updatedAt">> = [
      {
        id: "m_http_reqs",
        projectId: "default",
        name: "http.server.requests",
        type: "counter",
        unit: "req/s",
        description: "Inbound HTTP request throughput counter",
        tagKeys: ["service", "method", "statusCode", "environment", "host"],
        cardinalityLimit: 1000,
        retentionDays: 30,
      },
      {
        id: "m_http_dur",
        projectId: "default",
        name: "http.server.duration_ms",
        type: "histogram",
        unit: "ms",
        description: "Inbound HTTP request latency distribution",
        tagKeys: ["service", "endpoint", "statusCode", "environment"],
        cardinalityLimit: 500,
        retentionDays: 30,
      },
      {
        id: "m_cpu_util",
        projectId: "default",
        name: "system.cpu.utilization",
        type: "gauge",
        unit: "%",
        description: "Node CPU utilization percentage",
        tagKeys: ["host", "service", "environment"],
        cardinalityLimit: 200,
        retentionDays: 14,
      },
      {
        id: "m_mem_used",
        projectId: "default",
        name: "system.memory.used",
        type: "gauge",
        unit: "MB",
        description: "Memory footprint allocated",
        tagKeys: ["host", "service", "environment"],
        cardinalityLimit: 200,
        retentionDays: 14,
      },
      {
        id: "m_db_dur",
        projectId: "default",
        name: "db.query.latency_ms",
        type: "histogram",
        unit: "ms",
        description: "Database query execution latency",
        tagKeys: ["service", "operation", "database", "table"],
        cardinalityLimit: 300,
        retentionDays: 30,
      },
    ];

    const now = new Date().toISOString();
    for (const m of defaultMetrics) {
      this.definitionsStore.set(m.id, {
        ...m,
        createdAt: now,
        updatedAt: now,
      });
    }
  }

  // Metric Catalog CRUD
  async listDefinitions(projectId: string): Promise<MetricDefinition[]> {
    const list = Array.from(this.definitionsStore.values()).filter(
      (d) => d.projectId === projectId || d.projectId === "default",
    );
    return list.sort((a, b) => a.name.localeCompare(b.name));
  }

  async findDefinitionById(projectId: string, id: string): Promise<MetricDefinition | null> {
    const found = this.definitionsStore.get(id);
    if (!found || (found.projectId !== projectId && found.projectId !== "default")) return null;
    return found;
  }

  async createDefinition(
    projectId: string,
    input: CreateMetricDefinitionInput,
  ): Promise<MetricDefinition> {
    const id = `m_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const def: MetricDefinition = {
      id,
      projectId,
      name: input.name,
      type: input.type,
      unit: input.unit,
      description: input.description,
      tagKeys: input.tagKeys ?? [],
      cardinalityLimit: input.cardinalityLimit ?? 1000,
      retentionDays: input.retentionDays ?? 30,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    this.definitionsStore.set(id, def);
    return def;
  }

  async updateDefinition(
    projectId: string,
    id: string,
    input: UpdateMetricDefinitionInput,
  ): Promise<MetricDefinition | null> {
    const existing = await this.findDefinitionById(projectId, id);
    if (!existing) return null;

    const updated: MetricDefinition = {
      ...existing,
      name: input.name ?? existing.name,
      type: input.type ?? existing.type,
      unit: input.unit !== undefined ? input.unit : existing.unit,
      description: input.description !== undefined ? input.description : existing.description,
      tagKeys: input.tagKeys ?? existing.tagKeys,
      cardinalityLimit: input.cardinalityLimit ?? existing.cardinalityLimit,
      retentionDays: input.retentionDays ?? existing.retentionDays,
      updatedAt: new Date().toISOString(),
    };
    this.definitionsStore.set(id, updated);
    return updated;
  }

  async deleteDefinition(projectId: string, id: string): Promise<boolean> {
    const existing = await this.findDefinitionById(projectId, id);
    if (!existing) return false;
    return this.definitionsStore.delete(id);
  }

  // Generate Synthetic Telemetry Samples if store is empty
  private getOrCreateSamples(projectId: string, metricName: string): RawMetricSample[] {
    const key = `${projectId}:${metricName}`;
    let samples = this.samplesStore.get(key);
    if (samples && samples.length > 0) return samples;

    samples = [];
    const now = Date.now();
    const services = [
      "po-api-gateway",
      "po-event-workers",
      "po-auth-project-service",
      "po-vault-service",
    ];
    const endpoints = ["/v1/ingest", "/v1/auth/login", "/v1/projects", "/v1/vault/secrets"];

    // Generate last 60 minutes of data at 10-second intervals
    for (let t = now - 3600 * 1000; t <= now; t += 15 * 1000) {
      for (const service of services) {
        let baseVal = 50;
        if (metricName.includes("duration") || metricName.includes("latency")) {
          baseVal = service === "po-api-gateway" ? 18.5 : 45.2;
          // Random spikes
          if (Math.random() > 0.85) baseVal += Math.random() * 80;
        } else if (metricName.includes("cpu")) {
          baseVal = 25 + Math.sin(t / 100000) * 15 + Math.random() * 10;
        } else if (metricName.includes("memory")) {
          baseVal = 256 + Math.random() * 64;
        } else {
          baseVal = 100 + Math.random() * 50;
        }

        samples.push({
          timestamp: t,
          value: Number(baseVal.toFixed(2)),
          tags: {
            service,
            endpoint: endpoints[Math.floor(Math.random() * endpoints.length)]!,
            statusCode: Math.random() > 0.95 ? "500" : "200",
            environment: "production",
            host: `node-prod-${service.slice(3, 8)}-1`,
          },
        });
      }
    }

    this.samplesStore.set(key, samples);
    return samples;
  }

  // Execute Metric Query
  async queryMetric(projectId: string, query: MetricQueryInput): Promise<MetricTimeSeriesResult[]> {
    const rawSamples = this.getOrCreateSamples(projectId, query.metricName);

    // Apply tag filters
    let filtered = rawSamples;
    if (query.filters) {
      for (const [tagKey, tagVal] of Object.entries(query.filters)) {
        if (tagVal && tagVal !== "all") {
          filtered = filtered.filter((s) => s.tags[tagKey] === tagVal);
        }
      }
    }

    const startMs = query.startTime ? Date.parse(query.startTime) : Date.now() - 3600 * 1000;
    const endMs = query.endTime ? Date.parse(query.endTime) : Date.now();

    // Group By
    if (query.groupBy) {
      const groups = new Map<string, RawMetricSample[]>();
      for (const sample of filtered) {
        const groupVal = sample.tags[query.groupBy] || "other";
        const list = groups.get(groupVal) || [];
        list.push(sample);
        groups.set(groupVal, list);
      }

      const results: MetricTimeSeriesResult[] = [];
      for (const [grpVal, grpSamples] of groups.entries()) {
        const points = MetricsRollupEngine.rollupSamples(
          grpSamples,
          query.aggregation,
          query.timeBucket,
          startMs,
          endMs,
        );
        results.push({
          metricName: query.metricName,
          tags: { [query.groupBy]: grpVal },
          points,
        });
      }
      return results;
    }

    // Single series
    const points = MetricsRollupEngine.rollupSamples(
      filtered,
      query.aggregation,
      query.timeBucket,
      startMs,
      endMs,
    );
    return [
      {
        metricName: query.metricName,
        tags: query.filters || {},
        points,
      },
    ];
  }

  // Service Level Metrics Summary
  async getServiceMetricsSummary(projectId: string): Promise<ServiceMetricSummary[]> {
    return [
      {
        serviceName: "po-api-gateway",
        errorRatePercent: 0.12,
        throughputRps: 420.5,
        p95LatencyMs: 24.8,
        cpuUsagePercent: 32.4,
        memoryUsageMb: 245,
        hostCount: 3,
        containerCount: 6,
        status: "healthy",
      },
      {
        serviceName: "po-event-workers",
        errorRatePercent: 0.04,
        throughputRps: 850.0,
        p95LatencyMs: 14.2,
        cpuUsagePercent: 48.6,
        memoryUsageMb: 512,
        hostCount: 4,
        containerCount: 8,
        status: "healthy",
      },
      {
        serviceName: "po-auth-project-service",
        errorRatePercent: 0.28,
        throughputRps: 125.0,
        p95LatencyMs: 38.5,
        cpuUsagePercent: 22.1,
        memoryUsageMb: 198,
        hostCount: 2,
        containerCount: 4,
        status: "healthy",
      },
      {
        serviceName: "po-vault-service",
        errorRatePercent: 0.0,
        throughputRps: 64.2,
        p95LatencyMs: 8.4,
        cpuUsagePercent: 14.5,
        memoryUsageMb: 142,
        hostCount: 2,
        containerCount: 2,
        status: "healthy",
      },
      {
        serviceName: "po-incident-service",
        errorRatePercent: 1.85,
        throughputRps: 34.0,
        p95LatencyMs: 112.0,
        cpuUsagePercent: 68.2,
        memoryUsageMb: 380,
        hostCount: 2,
        containerCount: 3,
        status: "degraded",
      },
    ];
  }

  // Cardinality Guardrail Status
  async getCardinalityGuardrailStatus(projectId: string): Promise<CardinalityGuardrailStatus> {
    return {
      totalMetrics: this.definitionsStore.size,
      activeTagsCount: 24,
      highCardinalityViolations: [
        {
          metricName: "http.server.duration_ms",
          distinctValues: 482,
          threshold: 500,
          status: "warning",
        },
      ],
    };
  }
}
