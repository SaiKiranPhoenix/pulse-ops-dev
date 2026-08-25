import mongoose, { Schema, model, type HydratedDocument, type Model } from "mongoose";

export type DashboardEventRecord = {
  projectId: string;
  type: "log" | "error" | "metric";
  source: string;
  level: string | null;
  message: string | null;
  name: string | null;
  value: number | null;
  fingerprint: string;
  attributes: Record<string, unknown>;
  observedAt: Date;
  receivedAt: Date;
  createdAt: Date;
};

export type DashboardIncidentRecord = {
  projectId: string;
  title: string;
  severity: "low" | "medium" | "high" | "critical";
  status: "open" | "resolved";
  eventCount: number;
  lastSeenAt: Date;
  createdAt: Date;
};

export type DashboardVaultSecretRecord = {
  projectId: string;
  environment: string;
  key: string;
  status: "active" | "deleted";
  updatedAt: Date;
};

const dashboardEventSchema = new Schema<DashboardEventRecord>(
  {
    projectId: String,
    type: String,
    source: String,
    level: String,
    message: String,
    name: String,
    value: Number,
    fingerprint: String,
    attributes: { type: Schema.Types.Mixed, default: {} },
    observedAt: Date,
    receivedAt: Date,
  },
  { collection: "ingested_events", versionKey: false },
);

const dashboardIncidentSchema = new Schema<DashboardIncidentRecord>(
  {
    projectId: String,
    title: String,
    severity: String,
    status: String,
    eventCount: Number,
    lastSeenAt: Date,
  },
  { collection: "incidents", versionKey: false },
);

const dashboardVaultSecretSchema = new Schema<DashboardVaultSecretRecord>(
  {
    projectId: String,
    environment: String,
    key: String,
    status: String,
  },
  { collection: "vault_secrets", versionKey: false },
);

export type DashboardEventDocument = HydratedDocument<DashboardEventRecord>;
export type DashboardIncidentDocument = HydratedDocument<DashboardIncidentRecord>;
export type DashboardVaultSecretDocument = HydratedDocument<DashboardVaultSecretRecord>;

export const DashboardEventModel: Model<DashboardEventRecord> =
  mongoose.models.DashboardEvent ??
  model<DashboardEventRecord>("DashboardEvent", dashboardEventSchema);

export const DashboardIncidentModel: Model<DashboardIncidentRecord> =
  mongoose.models.DashboardIncident ??
  model<DashboardIncidentRecord>("DashboardIncident", dashboardIncidentSchema);

export const DashboardVaultSecretModel: Model<DashboardVaultSecretRecord> =
  mongoose.models.DashboardVaultSecret ??
  model<DashboardVaultSecretRecord>("DashboardVaultSecret", dashboardVaultSecretSchema);
