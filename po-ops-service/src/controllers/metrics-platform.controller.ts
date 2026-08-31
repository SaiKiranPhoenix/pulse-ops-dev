import type { Request, Response } from "express";
import { notFound, type MetricRollupAggregation, type MetricTimeBucket } from "@pulseops/shared";
import type { MetricsPlatformRepository } from "../repositories/metrics-platform.repository.js";

export class MetricsPlatformController {
  constructor(private readonly metricsRepo: MetricsPlatformRepository) {}

  private getProjectId(req: Request): string {
    const raw = (req.query.projectId as string) || (req.headers["x-project-id"] as string);
    return typeof raw === "string" ? raw : "default";
  }

  listDefinitions = async (req: Request, res: Response): Promise<void> => {
    const projectId = this.getProjectId(req);
    const metrics = await this.metricsRepo.listDefinitions(projectId);
    res.status(200).json({ status: "success", data: { metrics } });
  };

  createDefinition = async (req: Request, res: Response): Promise<void> => {
    const projectId = this.getProjectId(req);
    const metric = await this.metricsRepo.createDefinition(projectId, req.body);
    res.status(201).json({ status: "success", data: { metric } });
  };

  updateDefinition = async (req: Request, res: Response): Promise<void> => {
    const projectId = this.getProjectId(req);
    const id = String(req.params.id || "");
    const updated = await this.metricsRepo.updateDefinition(projectId, id, req.body);
    if (!updated) throw notFound("Metric definition not found");
    res.status(200).json({ status: "success", data: { metric: updated } });
  };

  deleteDefinition = async (req: Request, res: Response): Promise<void> => {
    const projectId = this.getProjectId(req);
    const id = String(req.params.id || "");
    const deleted = await this.metricsRepo.deleteDefinition(projectId, id);
    if (!deleted) throw notFound("Metric definition not found");
    res.status(200).json({ status: "success", data: { deleted: true } });
  };

  queryMetric = async (req: Request, res: Response): Promise<void> => {
    const projectId = this.getProjectId(req);
    const metricName = String(req.query.metricName || "http.server.requests");
    const aggregation = (req.query.aggregation as MetricRollupAggregation) || "avg";
    const timeBucket = (req.query.timeBucket as MetricTimeBucket) || "1m";
    const startTime = (req.query.startTime as string) || undefined;
    const endTime = (req.query.endTime as string) || undefined;
    const groupBy = (req.query.groupBy as string) || undefined;

    const series = await this.metricsRepo.queryMetric(projectId, {
      metricName,
      aggregation,
      timeBucket,
      startTime,
      endTime,
      groupBy,
    });

    res.status(200).json({ status: "success", data: { series } });
  };

  getServiceMetricsSummary = async (req: Request, res: Response): Promise<void> => {
    const projectId = this.getProjectId(req);
    const summaries = await this.metricsRepo.getServiceMetricsSummary(projectId);
    res.status(200).json({ status: "success", data: { summaries } });
  };

  getCardinalityGuardrails = async (req: Request, res: Response): Promise<void> => {
    const projectId = this.getProjectId(req);
    const guardrails = await this.metricsRepo.getCardinalityGuardrailStatus(projectId);
    res.status(200).json({ status: "success", data: { guardrails } });
  };
}
