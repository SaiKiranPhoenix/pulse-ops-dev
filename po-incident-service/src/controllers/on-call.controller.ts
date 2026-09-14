import type { Request, Response } from "express";
import { notFound } from "@pulseops/shared";
import type { OnCallService } from "../services/on-call.service.js";

export class OnCallController {
  constructor(private readonly onCallService: OnCallService) {}

  private getProjectId(req: Request): string {
    const raw = (req.query.projectId as string) || (req.headers["x-project-id"] as string);
    return typeof raw === "string" ? raw : "default";
  }

  listSchedules = async (req: Request, res: Response): Promise<void> => {
    const projectId = this.getProjectId(req);
    const schedules = await this.onCallService.listSchedules(projectId);
    res.status(200).json({ status: "success", data: { schedules } });
  };

  createSchedule = async (req: Request, res: Response): Promise<void> => {
    const projectId = this.getProjectId(req);
    const schedule = await this.onCallService.createSchedule(projectId, req.body);
    res.status(201).json({ status: "success", data: { schedule } });
  };

  updateSchedule = async (req: Request, res: Response): Promise<void> => {
    const projectId = this.getProjectId(req);
    const id = String(req.params.id || "");
    const updated = await this.onCallService.updateSchedule(projectId, id, req.body);
    if (!updated) throw notFound("On-call schedule not found");
    res.status(200).json({ status: "success", data: { schedule: updated } });
  };

  deleteSchedule = async (req: Request, res: Response): Promise<void> => {
    const projectId = this.getProjectId(req);
    const id = String(req.params.id || "");
    const deleted = await this.onCallService.deleteSchedule(projectId, id);
    if (!deleted) throw notFound("On-call schedule not found");
    res.status(200).json({ status: "success", data: { deleted: true } });
  };

  listPolicies = async (req: Request, res: Response): Promise<void> => {
    const projectId = this.getProjectId(req);
    const policies = await this.onCallService.listPolicies(projectId);
    res.status(200).json({ status: "success", data: { policies } });
  };

  createPolicy = async (req: Request, res: Response): Promise<void> => {
    const projectId = this.getProjectId(req);
    const policy = await this.onCallService.createPolicy(projectId, req.body);
    res.status(201).json({ status: "success", data: { policy } });
  };

  updatePolicy = async (req: Request, res: Response): Promise<void> => {
    const projectId = this.getProjectId(req);
    const id = String(req.params.id || "");
    const updated = await this.onCallService.updatePolicy(projectId, id, req.body);
    if (!updated) throw notFound("Escalation policy not found");
    res.status(200).json({ status: "success", data: { policy: updated } });
  };

  deletePolicy = async (req: Request, res: Response): Promise<void> => {
    const projectId = this.getProjectId(req);
    const id = String(req.params.id || "");
    const deleted = await this.onCallService.deletePolicy(projectId, id);
    if (!deleted) throw notFound("Escalation policy not found");
    res.status(200).json({ status: "success", data: { deleted: true } });
  };
}
