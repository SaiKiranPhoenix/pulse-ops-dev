import type { Request, Response } from "express";
import { successResponse } from "@pulseops/shared";
import type { AuditService } from "../services/audit.service.js";

export class AuditController {
  constructor(private readonly audit: AuditService) {}

  list = async (request: Request, response: Response): Promise<void> => {
    const projectId = String(request.query.projectId ?? "");
    const events = await this.audit.list(projectId);
    response.status(200).json(successResponse({ events }, String(response.locals.requestId)));
  };
}
