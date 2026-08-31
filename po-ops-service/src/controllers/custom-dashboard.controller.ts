import type { Request, Response } from "express";
import { notFound, type DashboardWidget } from "@pulseops/shared";
import type { CustomDashboardRepository } from "../repositories/custom-dashboard.repository.js";
import type { QueryExplorerService } from "../services/query-explorer.service.js";

export class CustomDashboardController {
  constructor(
    private readonly dashboardRepo: CustomDashboardRepository,
    private readonly explorerService: QueryExplorerService,
  ) {}

  private getProjectId(req: Request): string {
    const raw = (req.query.projectId as string) || (req.headers["x-project-id"] as string);
    return typeof raw === "string" ? raw : "";
  }

  list = async (req: Request, res: Response): Promise<void> => {
    const projectId = this.getProjectId(req);
    const dashboards = await this.dashboardRepo.list(projectId);

    res.status(200).json({
      status: "success",
      data: { dashboards },
    });
  };

  detail = async (req: Request, res: Response): Promise<void> => {
    const projectId = this.getProjectId(req);
    const dashboardId = String(req.params.dashboardId || "");

    const dashboard = await this.dashboardRepo.findById(projectId, dashboardId);
    if (!dashboard) {
      throw notFound("Custom dashboard not found");
    }

    res.status(200).json({
      status: "success",
      data: { dashboard },
    });
  };

  create = async (req: Request, res: Response): Promise<void> => {
    const projectId = this.getProjectId(req);
    const dashboard = await this.dashboardRepo.create(projectId, req.body);

    res.status(201).json({
      status: "success",
      data: { dashboard },
    });
  };

  update = async (req: Request, res: Response): Promise<void> => {
    const projectId = this.getProjectId(req);
    const dashboardId = String(req.params.dashboardId || "");

    const updated = await this.dashboardRepo.update(projectId, dashboardId, req.body);
    if (!updated) {
      throw notFound("Custom dashboard not found");
    }

    res.status(200).json({
      status: "success",
      data: { dashboard: updated },
    });
  };

  remove = async (req: Request, res: Response): Promise<void> => {
    const projectId = this.getProjectId(req);
    const dashboardId = String(req.params.dashboardId || "");

    const deleted = await this.dashboardRepo.delete(projectId, dashboardId);
    if (!deleted) {
      throw notFound("Custom dashboard not found");
    }

    res.status(200).json({
      status: "success",
      data: { deleted: true },
    });
  };

  clone = async (req: Request, res: Response): Promise<void> => {
    const projectId = this.getProjectId(req);
    const dashboardId = String(req.params.dashboardId || "");
    const { name } = req.body ?? {};

    const cloned = await this.dashboardRepo.clone(
      projectId,
      dashboardId,
      typeof name === "string" ? name : undefined,
    );
    if (!cloned) {
      throw notFound("Custom dashboard not found to clone");
    }

    res.status(201).json({
      status: "success",
      data: { dashboard: cloned },
    });
  };

  queryExplorer = async (req: Request, res: Response): Promise<void> => {
    const projectId = this.getProjectId(req);
    const queryPayload = req.method === "POST" ? req.body : req.query;

    const results = await this.explorerService.executeQuery(projectId, {
      queryType: queryPayload.queryType || "logs",
      serviceName: queryPayload.serviceName,
      environment: queryPayload.environment,
      severity: queryPayload.severity,
      searchTerm: queryPayload.searchTerm,
      timeRangeMinutes: queryPayload.timeRangeMinutes ? Number(queryPayload.timeRangeMinutes) : 60,
      limit: queryPayload.limit ? Number(queryPayload.limit) : 50,
    });

    res.status(200).json({
      status: "success",
      data: results,
    });
  };

  seedTemplates = async (req: Request, res: Response): Promise<void> => {
    const projectId = this.getProjectId(req);

    const templates = [
      {
        name: "API Health & Edge Gateway",
        description: "Throughput metrics, p95 latency timeline, and 5xx error rate",
        templateKey: "api_health",
        tags: ["api", "gateway", "edge"],
        refreshIntervalSeconds: 15,
        isDefault: true,
        widgets: [
          {
            id: "w_stat_req",
            type: "query_value" as const,
            title: "Total Ingestion Volume",
            gridPos: { x: 0, y: 0, w: 4, h: 3 },
            config: { metricName: "http_requests_total", unit: "req/s" },
          },
          {
            id: "w_stat_p95",
            type: "query_value" as const,
            title: "p95 Gateway Latency",
            gridPos: { x: 4, y: 0, w: 4, h: 3 },
            config: { metricName: "http_request_duration_ms", unit: "ms" },
          },
          {
            id: "w_stat_err",
            type: "query_value" as const,
            title: "5xx Error Rate",
            gridPos: { x: 8, y: 0, w: 4, h: 3 },
            config: { queryFilter: "status:5xx", unit: "%" },
          },
          {
            id: "w_ts_req",
            type: "timeseries" as const,
            title: "Traffic Timeline (RPS)",
            gridPos: { x: 0, y: 3, w: 8, h: 6 },
            config: { chartType: "area" as const, metricName: "http_requests_total" },
          },
          {
            id: "w_top_endpoints",
            type: "toplist" as const,
            title: "Top Requested Endpoints",
            gridPos: { x: 8, y: 3, w: 4, h: 6 },
            config: { topLimit: 5, groupBy: "route" },
          },
        ] as DashboardWidget[],
      },
      {
        name: "Queue & Worker Pipeline",
        description: "RabbitMQ backlog count, worker throughput, and processing lag",
        templateKey: "worker_health",
        tags: ["queue", "workers", "rabbitmq"],
        refreshIntervalSeconds: 30,
        isDefault: false,
        widgets: [
          {
            id: "w_worker_backlog",
            type: "timeseries" as const,
            title: "Queue Message Backlog",
            gridPos: { x: 0, y: 0, w: 6, h: 6 },
            config: { chartType: "line" as const, metricName: "queue_backlog_count" },
          },
          {
            id: "w_worker_logs",
            type: "log_stream" as const,
            title: "Worker Execution Stream",
            gridPos: { x: 6, y: 0, w: 6, h: 6 },
            config: { queryFilter: "service:po-event-workers" },
          },
        ] as DashboardWidget[],
      },
      {
        name: "Incident Command Center",
        description: "Live incident response triage, active anomalies, and on-call notes",
        templateKey: "incident_response",
        tags: ["incidents", "sre", "oncall"],
        refreshIntervalSeconds: 15,
        isDefault: false,
        widgets: [
          {
            id: "w_incidents_live",
            type: "incident_list" as const,
            title: "Active Open Incidents",
            gridPos: { x: 0, y: 0, w: 8, h: 6 },
            config: { queryFilter: "status:open" },
          },
          {
            id: "w_sre_notes",
            type: "markdown" as const,
            title: "On-Call Runbook Instructions",
            gridPos: { x: 8, y: 0, w: 4, h: 6 },
            config: {
              markdownContent:
                "### P1 / Critical Incident Protocol\n1. Acknowledge the incident within **5 minutes**.\n2. Verify the upstream payment gateway health.\n3. Enable silence window if executing hotfix.",
            },
          },
        ] as DashboardWidget[],
      },
    ];

    const createdList = [];
    for (const tpl of templates) {
      const doc = await this.dashboardRepo.create(projectId, tpl);
      createdList.push(doc);
    }

    res.status(201).json({
      status: "success",
      data: { seededCount: createdList.length, dashboards: createdList },
    });
  };
}
