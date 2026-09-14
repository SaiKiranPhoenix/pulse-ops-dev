import type { Request, Response } from "express";
import type { InfrastructureRepository } from "../repositories/infrastructure.repository.js";

export class InfrastructureController {
  constructor(private readonly infraRepo: InfrastructureRepository) {}

  private getProjectId(req: Request): string {
    const raw = (req.query.projectId as string) || (req.headers["x-project-id"] as string);
    return typeof raw === "string" ? raw : "default";
  }

  getOverview = async (req: Request, res: Response): Promise<void> => {
    const projectId = this.getProjectId(req);
    const overview = await this.infraRepo.getOverview(projectId);
    res.status(200).json({ status: "success", data: { overview } });
  };

  listHosts = async (req: Request, res: Response): Promise<void> => {
    const projectId = this.getProjectId(req);
    const hosts = await this.infraRepo.listHosts(projectId);
    res.status(200).json({ status: "success", data: { hosts } });
  };

  listContainers = async (req: Request, res: Response): Promise<void> => {
    const projectId = this.getProjectId(req);
    const containers = await this.infraRepo.listContainers(projectId);
    res.status(200).json({ status: "success", data: { containers } });
  };

  getDependencies = async (req: Request, res: Response): Promise<void> => {
    const projectId = this.getProjectId(req);
    const dependencies = await this.infraRepo.getDependencies(projectId);
    res.status(200).json({ status: "success", data: { dependencies } });
  };
}
