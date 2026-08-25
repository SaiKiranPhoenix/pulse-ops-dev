import mongoose, { Schema, model, type HydratedDocument, type Model } from "mongoose";

export type DashboardEventRecord = {
  projectId: string;
  type: "log" | "error" | "metric";
  source: string;
  level: string | null;
  message: string | null;
  name: string | null;
  value: number | null;
  unit: string | null;
  fingerprint: string;
  attributes: Record<string, unknown>;
  observedAt: Date;
  receivedAt: Date;
  createdAt: Date;
};

export type DashboardIncidentRecord = {
  projectId: string;
  fingerprint: string;
  title: string;
  summary: string | null;
  severity: "low" | "medium" | "high" | "critical";
  status: "open" | "acknowledged" | "resolved";
  eventCount: number;
  creationReason: string;
  acknowledgedAt: Date | null;
  resolutionNote: string | null;
  samples: Array<{
    eventId: string;
    telemetryMessageId: string;
    source: string;
    level: string | null;
    message: string | null;
    observedAt: Date;
    receivedAt: Date;
  }>;
  firstSeenAt: Date;
  lastSeenAt: Date;
  resolvedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export type DashboardVaultSecretRecord = {
  projectId: string;
  environment: string;
  key: string;
  status: "active" | "deleted";
  updatedAt: Date;
};

export type DashboardIngestionAcceptanceRecord = {
  projectId: string;
  idempotencyKey: string;
  event: {
    id: string;
    type: "log" | "error" | "metric";
    source: string;
    fingerprint: string;
    observedAt: string;
    receivedAt: string;
  };
  createdAt: Date;
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
    unit: String,
    fingerprint: String,
    attributes: { type: Schema.Types.Mixed, default: {} },
    observedAt: Date,
    receivedAt: Date,
  },
  { collection: "ingested_events", versionKey: false },
);

const dashboardIncidentSampleSchema = new Schema<DashboardIncidentRecord["samples"][number]>(
  {
    eventId: String,
    telemetryMessageId: String,
    source: String,
    level: String,
    message: String,
    observedAt: Date,
    receivedAt: Date,
  },
  { _id: false },
);

const dashboardIncidentSchema = new Schema<DashboardIncidentRecord>(
  {
    projectId: String,
    fingerprint: String,
    title: String,
    summary: String,
    severity: String,
    status: String,
    eventCount: Number,
    creationReason: String,
    acknowledgedAt: Date,
    resolutionNote: String,
    samples: { type: [dashboardIncidentSampleSchema], default: [] },
    firstSeenAt: Date,
    lastSeenAt: Date,
    resolvedAt: Date,
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

const dashboardIngestionAcceptanceSchema = new Schema<DashboardIngestionAcceptanceRecord>(
  {
    projectId: String,
    idempotencyKey: String,
    event: {
      id: String,
      type: String,
      source: String,
      fingerprint: String,
      observedAt: String,
      receivedAt: String,
    },
  },
  { collection: "ingestion_acceptances", timestamps: true, versionKey: false },
);

export type DashboardEventDocument = HydratedDocument<DashboardEventRecord>;
export type DashboardIncidentDocument = HydratedDocument<DashboardIncidentRecord>;
export type DashboardVaultSecretDocument = HydratedDocument<DashboardVaultSecretRecord>;
export type DashboardIngestionAcceptanceDocument =
  HydratedDocument<DashboardIngestionAcceptanceRecord>;

export const DashboardEventModel: Model<DashboardEventRecord> =
  mongoose.models.DashboardEvent ??
  model<DashboardEventRecord>("DashboardEvent", dashboardEventSchema);

export const DashboardIncidentModel: Model<DashboardIncidentRecord> =
  mongoose.models.DashboardIncident ??
  model<DashboardIncidentRecord>("DashboardIncident", dashboardIncidentSchema);

export const DashboardVaultSecretModel: Model<DashboardVaultSecretRecord> =
  mongoose.models.DashboardVaultSecret ??
  model<DashboardVaultSecretRecord>("DashboardVaultSecret", dashboardVaultSecretSchema);

export const DashboardIngestionAcceptanceModel: Model<DashboardIngestionAcceptanceRecord> =
  mongoose.models.DashboardIngestionAcceptance ??
  model<DashboardIngestionAcceptanceRecord>(
    "DashboardIngestionAcceptance",
    dashboardIngestionAcceptanceSchema,
  );
