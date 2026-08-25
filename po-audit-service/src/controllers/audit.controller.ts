import type { Request, Response } from "express";
import { badRequest, successResponse } from "@pulseops/shared";
import type { AuditService } from "../services/audit.service.js";
import { auditListQuerySchema } from "../validators/audit.validator.js";

export class AuditController {
  constructor(private readonly audit: AuditService) {}

  list = async (request: Request, response: Response): Promise<void> => {
    const result = auditListQuerySchema.safeParse(request.query);

    if (!result.success) {
      throw badRequest("Invalid audit query", { issues: result.error.issues });
    }

    const events = await this.audit.list(result.data);
    response.status(200).json(successResponse({ events }, String(response.locals.requestId)));
  };
}
