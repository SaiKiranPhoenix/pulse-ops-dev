import type { Request, Response } from "express";
import { notFound } from "@pulseops/shared";
import type { LogPipelineRepository } from "../repositories/log-pipeline.repository.js";

export class LogPipelineController {
  constructor(private readonly pipelineRepo: LogPipelineRepository) {}

  private getProjectId(req: Request): string {
    const raw = (req.query.projectId as string) || (req.headers["x-project-id"] as string);
    return typeof raw === "string" ? raw : "";
  }

  // Rules
  listRules = async (req: Request, res: Response): Promise<void> => {
    const projectId = this.getProjectId(req);
    const rules = await this.pipelineRepo.listRules(projectId);
    res.status(200).json({ status: "success", data: { rules } });
  };

  detailRule = async (req: Request, res: Response): Promise<void> => {
    const projectId = this.getProjectId(req);
    const ruleId = String(req.params.ruleId || "");
    const rule = await this.pipelineRepo.findRuleById(projectId, ruleId);
    if (!rule) throw notFound("Log pipeline rule not found");
    res.status(200).json({ status: "success", data: { rule } });
  };

  createRule = async (req: Request, res: Response): Promise<void> => {
    const projectId = this.getProjectId(req);
    const rule = await this.pipelineRepo.createRule(projectId, req.body);
    res.status(201).json({ status: "success", data: { rule } });
  };

  updateRule = async (req: Request, res: Response): Promise<void> => {
    const projectId = this.getProjectId(req);
    const ruleId = String(req.params.ruleId || "");
    const updated = await this.pipelineRepo.updateRule(projectId, ruleId, req.body);
    if (!updated) throw notFound("Log pipeline rule not found");
    res.status(200).json({ status: "success", data: { rule: updated } });
  };

  deleteRule = async (req: Request, res: Response): Promise<void> => {
    const projectId = this.getProjectId(req);
    const ruleId = String(req.params.ruleId || "");
    const deleted = await this.pipelineRepo.deleteRule(projectId, ruleId);
    if (!deleted) throw notFound("Log pipeline rule not found");
    res.status(200).json({ status: "success", data: { deleted: true } });
  };

  // Retention
  getRetention = async (req: Request, res: Response): Promise<void> => {
    const projectId = this.getProjectId(req);
    const retention = await this.pipelineRepo.getRetention(projectId);
    res.status(200).json({ status: "success", data: { retention } });
  };

  updateRetention = async (req: Request, res: Response): Promise<void> => {
    const projectId = this.getProjectId(req);
    const updated = await this.pipelineRepo.updateRetention(projectId, req.body);
    res.status(200).json({ status: "success", data: { retention: updated } });
  };

  // Saved Searches
  listSavedSearches = async (req: Request, res: Response): Promise<void> => {
    const projectId = this.getProjectId(req);
    const savedSearches = await this.pipelineRepo.listSavedSearches(projectId);
    res.status(200).json({ status: "success", data: { savedSearches } });
  };

  createSavedSearch = async (req: Request, res: Response): Promise<void> => {
    const projectId = this.getProjectId(req);
    const savedSearch = await this.pipelineRepo.createSavedSearch(projectId, req.body);
    res.status(201).json({ status: "success", data: { savedSearch } });
  };

  deleteSavedSearch = async (req: Request, res: Response): Promise<void> => {
    const projectId = this.getProjectId(req);
    const searchId = String(req.params.searchId || "");
    const deleted = await this.pipelineRepo.deleteSavedSearch(projectId, searchId);
    if (!deleted) throw notFound("Saved log search not found");
    res.status(200).json({ status: "success", data: { deleted: true } });
  };

  // Context View (+- 25 surrounding events)
  getContext = async (req: Request, res: Response): Promise<void> => {
    const projectId = this.getProjectId(req);
    const eventId = String(req.params.eventId || "");
    const context = await this.pipelineRepo.getLogContext(projectId, eventId);
    res.status(200).json({ status: "success", data: context });
  };

  // Volume Analytics
  getVolumeAnalytics = async (req: Request, res: Response): Promise<void> => {
    const projectId = this.getProjectId(req);
    const analytics = await this.pipelineRepo.getVolumeAnalytics(projectId);
    res.status(200).json({ status: "success", data: { analytics } });
  };

  // Export / Archive Download
  exportLogs = async (req: Request, res: Response): Promise<void> => {
    const projectId = this.getProjectId(req);
    const format = req.query.format === "csv" ? "csv" : "ndjson";

    const sampleLogs = [
      {
        id: `evt_exp_1`,
        timestamp: new Date().toISOString(),
        service: "po-api-gateway",
        level: "info",
        message: "GET /v1/health 200 OK (2.1ms)",
        projectId,
      },
      {
        id: `evt_exp_2`,
        timestamp: new Date().toISOString(),
        service: "po-auth-project-service",
        level: "info",
        message: "User session authenticated for saikiran@pulseops.internal",
        projectId,
      },
      {
        id: `evt_exp_3`,
        timestamp: new Date().toISOString(),
        service: "po-vault-service",
        level: "warn",
        message: "Secret lease expiring in 300 seconds for client api_prod_77",
        projectId,
      },
    ];

    if (format === "csv") {
      const headers = Object.keys(sampleLogs[0]!).join(",");
      const rows = sampleLogs
        .map((l) =>
          Object.values(l)
            .map((v) => `"${v}"`)
            .join(","),
        )
        .join("\n");
      res.setHeader("Content-Type", "text/csv");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="logs_${projectId}_${Date.now()}.csv"`,
      );
      res.status(200).send(`${headers}\n${rows}`);
    } else {
      const ndjson = sampleLogs.map((l) => JSON.stringify(l)).join("\n");
      res.setHeader("Content-Type", "application/x-ndjson");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="logs_${projectId}_${Date.now()}.ndjson"`,
      );
      res.status(200).send(ndjson);
    }
  };
}
