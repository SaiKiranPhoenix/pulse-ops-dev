import type { Request, Response } from "express";
import { notFound } from "@pulseops/shared";
import type { SloRepository } from "../repositories/slo.repository.js";
import type { SloEvaluatorService } from "../services/slo-evaluator.service.js";

export class SloController {
  constructor(
    private readonly sloRepo: SloRepository,
    private readonly evaluator: SloEvaluatorService,
  ) {}

  private getProjectId(req: Request): string {
    const raw = (req.query.projectId as string) || (req.headers["x-project-id"] as string);
    return typeof raw === "string" ? raw : "";
  }

  list = async (req: Request, res: Response): Promise<void> => {
    const projectId = this.getProjectId(req);
    const serviceName = req.query.serviceName as string | undefined;
    const environment = req.query.environment as string | undefined;
    const enabled = req.query.enabled === undefined ? undefined : req.query.enabled === "true";

    const slos = await this.sloRepo.list(projectId, {
      serviceName,
      environment,
      enabled,
    });

    res.status(200).json({
      status: "success",
      data: { slos },
    });
  };

  detail = async (req: Request, res: Response): Promise<void> => {
    const projectId = this.getProjectId(req);
    const sloId = String(req.params.sloId || "");

    const slo = await this.sloRepo.findById(projectId, sloId);
    if (!slo) {
      throw notFound("SLO definition not found");
    }

    res.status(200).json({
      status: "success",
      data: { slo },
    });
  };

  create = async (req: Request, res: Response): Promise<void> => {
    const projectId = this.getProjectId(req);
    const created = await this.sloRepo.create(projectId, req.body);

    // Initial evaluation
    const { slo } = await this.evaluator.evaluateSlo(created);

    res.status(201).json({
      status: "success",
      data: { slo },
    });
  };

  update = async (req: Request, res: Response): Promise<void> => {
    const projectId = this.getProjectId(req);
    const sloId = String(req.params.sloId || "");

    const updated = await this.sloRepo.update(projectId, sloId, req.body);
    if (!updated) {
      throw notFound("SLO definition not found");
    }

    res.status(200).json({
      status: "success",
      data: { slo: updated },
    });
  };

  remove = async (req: Request, res: Response): Promise<void> => {
    const projectId = this.getProjectId(req);
    const sloId = String(req.params.sloId || "");

    const deleted = await this.sloRepo.delete(projectId, sloId);
    if (!deleted) {
      throw notFound("SLO definition not found");
    }

    res.status(200).json({
      status: "success",
      data: { deleted: true },
    });
  };

  evaluate = async (req: Request, res: Response): Promise<void> => {
    const projectId = this.getProjectId(req);
    const sloId = String(req.params.sloId || "");

    const slo = await this.sloRepo.findById(projectId, sloId);
    if (!slo) {
      throw notFound("SLO definition not found");
    }

    const result = await this.evaluator.evaluateSlo(slo);

    res.status(200).json({
      status: "success",
      data: result,
    });
  };

  report = async (req: Request, res: Response): Promise<void> => {
    const projectId = (req.query.projectId as string) || (req.headers["x-project-id"] as string);
    const reportData = await this.evaluator.generateReport(projectId);

    res.status(200).json({
      status: "success",
      data: { report: reportData },
    });
  };

  seedDemo = async (req: Request, res: Response): Promise<void> => {
    const projectId = (req.query.projectId as string) || (req.headers["x-project-id"] as string);

    const demoSlos = [
      {
        name: "API Gateway Availability",
        description: "99.95% successful requests without 5xx server errors",
        sli: {
          type: "availability" as const,
          serviceName: "po-api-gateway",
          environment: "production",
        },
        target: {
          targetPercent: 99.95,
          warningPercent: 99.98,
          rollingWindowDays: 30,
        },
        tags: ["core", "api", "tier_1"],
      },
      {
        name: "Checkout Service p95 Latency",
        description: "99.0% of checkout transactions completed under 300ms",
        sli: {
          type: "latency" as const,
          serviceName: "sample-express-app",
          thresholdMs: 300,
          environment: "production",
        },
        target: {
          targetPercent: 99.0,
          warningPercent: 99.5,
          rollingWindowDays: 7,
        },
        tags: ["checkout", "latency"],
      },
      {
        name: "Event Ingestion Error Rate",
        description: "Background queue ingestion error rate kept under 0.1%",
        sli: {
          type: "error_rate" as const,
          serviceName: "po-ingestion-service",
          environment: "production",
        },
        target: {
          targetPercent: 99.9,
          warningPercent: 99.95,
          rollingWindowDays: 30,
        },
        tags: ["ingestion", "reliability"],
      },
    ];

    const createdList = [];
    for (const item of demoSlos) {
      const created = await this.sloRepo.create(projectId, item);
      const evaluated = await this.evaluator.evaluateSlo(created);
      createdList.push(evaluated.slo);
    }

    res.status(201).json({
      status: "success",
      data: { seededCount: createdList.length, slos: createdList },
    });
  };
}
