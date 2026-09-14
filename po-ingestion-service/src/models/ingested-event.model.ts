import mongoose, { Schema, model, type HydratedDocument, type Model } from "mongoose";

export type IngestedEventType = "log" | "error" | "metric";

export type IngestedEventRecord = {
  projectId: string;
  type: IngestedEventType;
  source: string;
  level: string | null;
  message: string | null;
  name: string | null;
  value: number | null;
  unit: string | null;
  fingerprint: string;
  attributes: Record<string, unknown>;
  observedAt: Date;
  idempotencyKey: string | null;
  receivedAt: Date;
  createdAt: Date;
  updatedAt: Date;
};

export type IngestedEventDocument = HydratedDocument<IngestedEventRecord>;

const ingestedEventSchema = new Schema<IngestedEventRecord>(
  {
    projectId: { type: String, required: true, index: true },
    type: { type: String, enum: ["log", "error", "metric"], required: true, index: true },
    source: { type: String, required: true, trim: true, maxlength: 160 },
    level: { type: String, default: null, trim: true, maxlength: 40 },
    message: { type: String, default: null, trim: true, maxlength: 4_000 },
    name: { type: String, default: null, trim: true, maxlength: 160 },
    value: { type: Number, default: null },
    unit: { type: String, default: null, trim: true, maxlength: 40 },
    fingerprint: { type: String, required: true, index: true },
    attributes: { type: Schema.Types.Mixed, required: true, default: {} },
    observedAt: { type: Date, required: true, index: true },
    idempotencyKey: { type: String, default: null, index: true },
    receivedAt: { type: Date, required: true, default: () => new Date(), index: true },
  },
  {
    collection: "ingested_events",
    timestamps: true,
    versionKey: false,
  },
);

ingestedEventSchema.index(
  { projectId: 1, idempotencyKey: 1 },
  {
    unique: true,
    name: "uniq_ingested_events_project_idempotency",
    partialFilterExpression: { idempotencyKey: { $type: "string" } },
  },
);
ingestedEventSchema.index(
  { projectId: 1, type: 1, receivedAt: -1 },
  { name: "idx_events_project_type_received" },
);
ingestedEventSchema.index(
  { projectId: 1, receivedAt: -1, _id: -1 },
  { name: "idx_events_project_received_cursor" },
);
ingestedEventSchema.index(
  { projectId: 1, fingerprint: 1, receivedAt: -1 },
  { name: "idx_events_project_fingerprint_received" },
);
ingestedEventSchema.index(
  { projectId: 1, "attributes.environment": 1, type: 1, receivedAt: -1 },
  { name: "idx_events_project_env_type_received" },
);
ingestedEventSchema.index(
  { projectId: 1, "attributes.traceId": 1, "attributes.spanId": 1, observedAt: 1, receivedAt: 1 },
  { name: "idx_events_project_trace_span_time" },
);
ingestedEventSchema.index(
  { receivedAt: 1 },
  { expireAfterSeconds: 2_592_000, name: "ttl_events_received_at_30_days" },
);

export const IngestedEventModel: Model<IngestedEventRecord> =
  mongoose.models.IngestedEvent ?? model<IngestedEventRecord>("IngestedEvent", ingestedEventSchema);
