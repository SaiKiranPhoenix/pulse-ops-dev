import type { Request, Response } from "express";
import { notFound } from "@pulseops/shared";
import type { UptimeRumRepository } from "../repositories/uptime-rum.repository.js";

export class UptimeRumController {
  constructor(private readonly uptimeRepo: UptimeRumRepository) {}

  private getProjectId(req: Request): string {
    const raw = (req.query.projectId as string) || (req.headers["x-project-id"] as string);
    return typeof raw === "string" ? raw : "default";
  }

  listChecks = async (req: Request, res: Response): Promise<void> => {
    const projectId = this.getProjectId(req);
    const checks = await this.uptimeRepo.listChecks(projectId);
    res.status(200).json({ status: "success", data: { checks } });
  };

  createCheck = async (req: Request, res: Response): Promise<void> => {
    const projectId = this.getProjectId(req);
    const check = await this.uptimeRepo.createCheck(projectId, req.body);
    res.status(201).json({ status: "success", data: { check } });
  };

  updateCheck = async (req: Request, res: Response): Promise<void> => {
    const projectId = this.getProjectId(req);
    const id = String(req.params.id || "");
    const updated = await this.uptimeRepo.updateCheck(projectId, id, req.body);
    if (!updated) throw notFound("Uptime check not found");
    res.status(200).json({ status: "success", data: { check: updated } });
  };

  deleteCheck = async (req: Request, res: Response): Promise<void> => {
    const projectId = this.getProjectId(req);
    const id = String(req.params.id || "");
    const deleted = await this.uptimeRepo.deleteCheck(projectId, id);
    if (!deleted) throw notFound("Uptime check not found");
    res.status(200).json({ status: "success", data: { deleted: true } });
  };

  testCheck = async (req: Request, res: Response): Promise<void> => {
    const projectId = this.getProjectId(req);
    const id = String(req.params.id || "");
    const result = await this.uptimeRepo.executeAndRecordCheck(projectId, id);
    if (!result) throw notFound("Uptime check not found");
    res.status(200).json({ status: "success", data: { result } });
  };

  getCheckHistory = async (req: Request, res: Response): Promise<void> => {
    const projectId = this.getProjectId(req);
    const id = String(req.params.id || "");
    const history = await this.uptimeRepo.getCheckHistory(projectId, id);
    res.status(200).json({ status: "success", data: { history } });
  };

  getRumOverview = async (req: Request, res: Response): Promise<void> => {
    const projectId = this.getProjectId(req);
    const overview = await this.uptimeRepo.getRumOverview(projectId);
    res.status(200).json({ status: "success", data: { overview } });
  };

  recordRumVitals = async (req: Request, res: Response): Promise<void> => {
    const projectId = this.getProjectId(req);
    const event = await this.uptimeRepo.recordRumEvent(projectId, req.body);
    res.status(201).json({ status: "success", data: { event } });
  };
}
