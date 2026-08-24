import type { Request, Response } from "express";
import type { ProxyService, ProxyTarget } from "../services/proxy.service.js";

export type ProxyTargets = {
  readonly authProject: ProxyTarget;
  readonly audit: ProxyTarget;
  readonly ingestion: ProxyTarget;
  readonly incident: ProxyTarget;
  readonly ops: ProxyTarget;
  readonly vault: ProxyTarget;
};

export class ProxyController {
  constructor(
    private readonly proxy: ProxyService,
    private readonly targets: ProxyTargets,
  ) {}

  authProject = async (request: Request, response: Response): Promise<void> => {
    await this.proxy.forward(request, response, this.targets.authProject);
  };

  audit = async (request: Request, response: Response): Promise<void> => {
    await this.proxy.forward(request, response, this.targets.audit);
  };

  ingestion = async (request: Request, response: Response): Promise<void> => {
    await this.proxy.forward(request, response, this.targets.ingestion);
  };

  incident = async (request: Request, response: Response): Promise<void> => {
    await this.proxy.forward(request, response, this.targets.incident);
  };

  ops = async (request: Request, response: Response): Promise<void> => {
    await this.proxy.forward(request, response, this.targets.ops);
  };

  vault = async (request: Request, response: Response): Promise<void> => {
    await this.proxy.forward(request, response, this.targets.vault);
  };
}
