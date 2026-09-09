import type { Request, Response } from "express";
import { badRequest, successResponse } from "@pulseops/shared";
import type { AuditService } from "../services/audit.service.js";
import {
  auditIntegrityQuerySchema,
  auditListQuerySchema,
  auditReportQuerySchema,
} from "../validators/audit.validator.js";

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

  export = async (request: Request, response: Response): Promise<void> => {
    const result = auditListQuerySchema.safeParse(request.query);

    if (!result.success) {
      throw badRequest("Invalid audit export query", { issues: result.error.issues });
    }

    const exported = await this.audit.export(result.data);
    response
      .status(200)
      .json(successResponse({ export: exported }, String(response.locals.requestId)));
  };

  report = async (request: Request, response: Response): Promise<void> => {
    const result = auditReportQuerySchema.safeParse(request.query);

    if (!result.success) {
      throw badRequest("Invalid audit report query", { issues: result.error.issues });
    }

    const report = await this.audit.report(result.data);
    response.status(200).json(successResponse({ report }, String(response.locals.requestId)));
  };

  integrity = async (request: Request, response: Response): Promise<void> => {
    const result = auditIntegrityQuerySchema.safeParse(request.query);

    if (!result.success) {
      throw badRequest("Invalid audit integrity query", { issues: result.error.issues });
    }

    const integrity = await this.audit.checkIntegrity(result.data);
    response.status(200).json(successResponse({ integrity }, String(response.locals.requestId)));
  };
}
