import { AuditController } from "../controllers/audit.controller.js";
import { MongoAuditEventRepository } from "../repositories/audit-event.repository.js";
import { AuditService } from "./audit.service.js";

export type AuditServiceDependencies = {
  readonly auditController: AuditController;
  readonly auditService: AuditService;
};

export function createAuditServiceDependencies(): AuditServiceDependencies {
  const auditService = new AuditService(new MongoAuditEventRepository());

  return {
    auditController: new AuditController(auditService),
    auditService,
  };
}
