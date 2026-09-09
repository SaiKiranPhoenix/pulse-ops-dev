import type {
  AuditEventFilter,
  AuditEventRepository,
  SafeAuditEventRecord,
} from "../repositories/audit-event.repository.js";

export type AuditBackendCapabilities = {
  readonly durable: boolean;
  readonly export: boolean;
  readonly integrityCheck: boolean;
  readonly retentionDays: number | null;
};

export interface AuditBackend {
  readonly name: string;
  readonly capabilities: AuditBackendCapabilities;
  createFromMessage: AuditEventRepository["createFromMessage"];
  findByProject(filter: AuditEventFilter): Promise<SafeAuditEventRecord[]>;
}

export class MongoAuditBackend implements AuditBackend {
  readonly name = "mongodb";
  readonly capabilities: AuditBackendCapabilities;

  constructor(
    private readonly repository: AuditEventRepository,
    options: { readonly retentionDays?: number | null } = {},
  ) {
    this.capabilities = {
      durable: true,
      export: true,
      integrityCheck: true,
      retentionDays: options.retentionDays ?? null,
    };
  }

  createFromMessage: AuditEventRepository["createFromMessage"] = (message) =>
    this.repository.createFromMessage(message);

  async findByProject(filter: AuditEventFilter): Promise<SafeAuditEventRecord[]> {
    return this.repository.findByProject(filter);
  }
}

export const plannedAuditBackends = [
  {
    name: "file",
    status: "planned",
    purpose: "Append-only local audit sink for disconnected development and forensic snapshots.",
  },
  {
    name: "webhook",
    status: "planned",
    purpose: "Signed delivery to external SIEM, GRC, or compliance systems.",
  },
] as const;
