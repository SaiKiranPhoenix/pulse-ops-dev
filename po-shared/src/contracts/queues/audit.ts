import { z } from "zod";

export const AUDIT_EXCHANGE = "pulseops.audit.x";
export const AUDIT_VAULT_ROUTING_KEY = "audit.vault.v1";
export const AUDIT_QUEUE = "pulseops.audit.q";

export const auditActorTypeSchema = z.enum(["user", "integration", "service"]);
export const auditActionSchema = z.enum([
  "vault.secret.create",
  "vault.secret.reveal",
  "vault.secret.update",
  "vault.secret.delete",
  "vault.token.create",
  "vault.token.renew",
  "vault.token.revoke",
  "vault.token.revoke_self",
  "vault.auth_method.create",
  "vault.auth_method.disable",
  "vault.auth_method.login",
  "vault.integration.fetch",
  "vault.integration.bundle_fetch",
  "vault.lease.issue",
  "vault.lease.renew",
  "vault.lease.revoke",
  "vault.lease.expire",
  "vault.audit.export",
  "vault.audit.integrity_check",
]);
export const auditResultSchema = z.enum(["success", "failure"]);

export const vaultAuditEventMessageSchema = z.object({
  messageId: z.string().min(1),
  schemaVersion: z.literal(1),
  projectId: z.string().min(1),
  actorType: auditActorTypeSchema,
  actorId: z.string().min(1),
  action: auditActionSchema,
  result: auditResultSchema,
  environment: z.string().min(1).nullable(),
  secretKey: z.string().min(1).nullable(),
  tokenPrefix: z.string().min(1).nullable(),
  reason: z.string().min(1).max(200).nullable(),
  correlationId: z.string().min(1),
  occurredAt: z.string().datetime(),
});

export type VaultAuditEventMessage = z.infer<typeof vaultAuditEventMessageSchema>;
