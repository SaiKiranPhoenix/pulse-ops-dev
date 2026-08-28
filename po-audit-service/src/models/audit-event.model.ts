import mongoose, { Schema, model, type HydratedDocument, type Model } from "mongoose";

export type AuditEventRecord = {
  messageId: string;
  projectId: string;
  actorType: "user" | "integration" | "service";
  actorId: string;
  action: string;
  result: "success" | "failure";
  environment: string | null;
  secretKey: string | null;
  tokenPrefix: string | null;
  reason: string | null;
  correlationId: string;
  occurredAt: Date;
  createdAt: Date;
  updatedAt: Date;
};

export type AuditEventDocument = HydratedDocument<AuditEventRecord>;

const auditEventSchema = new Schema<AuditEventRecord>(
  {
    messageId: { type: String, required: true, unique: true },
    projectId: { type: String, required: true, index: true },
    actorType: { type: String, enum: ["user", "integration", "service"], required: true },
    actorId: { type: String, required: true, index: true },
    action: { type: String, required: true, index: true },
    result: { type: String, enum: ["success", "failure"], required: true, index: true },
    environment: { type: String, default: null, index: true },
    secretKey: { type: String, default: null },
    tokenPrefix: { type: String, default: null },
    reason: { type: String, default: null },
    correlationId: { type: String, required: true, index: true },
    occurredAt: { type: Date, required: true, index: true },
  },
  {
    collection: "audit_events",
    timestamps: true,
    versionKey: false,
  },
);

auditEventSchema.index(
  { projectId: 1, occurredAt: -1 },
  { name: "idx_audit_events_project_occurred" },
);
auditEventSchema.index(
  { projectId: 1, environment: 1, occurredAt: -1 },
  { name: "idx_audit_events_project_env_occurred" },
);
auditEventSchema.index(
  { projectId: 1, action: 1, result: 1, occurredAt: -1 },
  { name: "idx_audit_events_project_action_result_occurred" },
);
auditEventSchema.index(
  { projectId: 1, actorType: 1, actorId: 1, occurredAt: -1 },
  { name: "idx_audit_events_project_actor_occurred" },
);
auditEventSchema.index(
  { projectId: 1, secretKey: 1, occurredAt: -1 },
  { name: "idx_audit_events_project_secret_occurred" },
);

export const AuditEventModel: Model<AuditEventRecord> =
  mongoose.models.AuditEvent ?? model<AuditEventRecord>("AuditEvent", auditEventSchema);
