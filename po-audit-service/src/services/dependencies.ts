import { AuditController } from "../controllers/audit.controller.js";
import {
  noopRealtimeVaultAuditPublisher,
  type RealtimeVaultAuditPublisher,
} from "../events/publishers/realtime-vault-audit.publisher.js";
import { MongoAuditEventRepository } from "../repositories/audit-event.repository.js";
import { MongoAuditBackend } from "./audit-backend.service.js";
import { AuditService } from "./audit.service.js";

export type AuditServiceDependencies = {
  readonly auditController: AuditController;
  readonly auditService: AuditService;
};

export function createAuditServiceDependencies(
  realtimeVaultAudit: RealtimeVaultAuditPublisher = noopRealtimeVaultAuditPublisher,
): AuditServiceDependencies {
  const auditService = new AuditService(
    new MongoAuditBackend(new MongoAuditEventRepository(), { retentionDays: 365 }),
    realtimeVaultAudit,
  );

  return {
    auditController: new AuditController(auditService),
    auditService,
  };
}
