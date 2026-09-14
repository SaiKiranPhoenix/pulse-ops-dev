import type { Request, Response } from "express";
import type { VaultPolicyService } from "../services/vault-policy.service.js";

export class VaultPolicyController {
  private readonly service: VaultPolicyService;

  public constructor(service: VaultPolicyService) {
    this.service = service;
  }

  public list = async (req: Request, res: Response): Promise<void> => {
    const projectId = (req.query.projectId as string) || "default";
    const policies = await this.service.listPolicies(projectId);
    res.status(200).json({ status: "success", data: { policies } });
  };

  public get = async (req: Request, res: Response): Promise<void> => {
    const projectId = (req.query.projectId as string) || "default";
    const policyId = typeof req.params.policyId === "string" ? req.params.policyId : "";
    if (!policyId) {
      res.status(400).json({ status: "error", message: "Policy ID is required" });
      return;
    }
    const policy = await this.service.getPolicy(projectId, policyId);
    if (!policy) {
      res.status(404).json({ status: "error", message: "Policy not found" });
      return;
    }
    res.status(200).json({ status: "success", data: { policy } });
  };

  public create = async (req: Request, res: Response): Promise<void> => {
    const projectId = (req.query.projectId as string) || "default";
    const actorId = (req as any).user?.id || "admin";
    const policy = await this.service.createPolicy(projectId, req.body, actorId);
    res.status(201).json({ status: "success", data: { policy } });
  };

  public update = async (req: Request, res: Response): Promise<void> => {
    const projectId = (req.query.projectId as string) || "default";
    const policyId = typeof req.params.policyId === "string" ? req.params.policyId : "";
    if (!policyId) {
      res.status(400).json({ status: "error", message: "Policy ID is required" });
      return;
    }
    const actorId = (req as any).user?.id || "admin";
    const policy = await this.service.updatePolicy(projectId, policyId, req.body, actorId);
    if (!policy) {
      res.status(404).json({ status: "error", message: "Policy not found" });
      return;
    }
    res.status(200).json({ status: "success", data: { policy } });
  };

  public delete = async (req: Request, res: Response): Promise<void> => {
    const projectId = (req.query.projectId as string) || "default";
    const policyId = typeof req.params.policyId === "string" ? req.params.policyId : "";
    if (!policyId) {
      res.status(400).json({ status: "error", message: "Policy ID is required" });
      return;
    }
    const deleted = await this.service.deletePolicy(projectId, policyId);
    res.status(200).json({ status: "success", data: { deleted } });
  };

  public simulate = async (req: Request, res: Response): Promise<void> => {
    const projectId = (req.query.projectId as string) || "default";
    const result = await this.service.simulate({
      projectId,
      path: req.body.path,
      capability: req.body.capability,
      policyIds: req.body.policyIds,
      environment: req.body.environment,
      userRole: req.body.userRole,
    });
    res.status(200).json({ status: "success", data: { result } });
  };
}
