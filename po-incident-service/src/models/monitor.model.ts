import mongoose, { Schema, type Document, type Model } from "mongoose";
import type {
  MonitorCondition,
  MonitorRuleType,
  MonitorSeverity,
  MonitorState,
} from "@pulseops/shared";

export interface MonitorDocument extends Document {
  projectId: string;
  name: string;
  description?: string;
  ruleType: MonitorRuleType;
  severity: MonitorSeverity;
  state: MonitorState;
  enabled: boolean;
  condition: MonitorCondition;
  evaluationIntervalSeconds: number;
  lastEvaluatedAt?: Date | null;
  lastStateChangeAt?: Date | null;
  lastEvaluatedValue?: number | null;
  lastEvaluationMessage?: string | null;
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
}

const monitorConditionSchema = new Schema<MonitorCondition>(
  {
    comparator: {
      type: String,
      enum: [">", ">=", "<", "<=", "==", "!="],
      required: true,
    },
    threshold: {
      type: Number,
      required: true,
    },
    timeWindowMinutes: {
      type: Number,
      default: 5,
      min: 1,
      max: 1440,
    },
    metricName: {
      type: String,
      trim: true,
    },
    logPattern: {
      type: String,
      trim: true,
    },
    serviceName: {
      type: String,
      trim: true,
    },
    environment: {
      type: String,
      trim: true,
    },
  },
  { _id: false },
);

export const monitorSchema = new Schema<MonitorDocument>(
  {
    projectId: {
      type: String,
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      trim: true,
    },
    ruleType: {
      type: String,
      enum: [
        "log_match",
        "metric_threshold",
        "error_rate",
        "latency_p95",
        "queue_backlog",
        "worker_stale",
        "vault_anomaly",
      ],
      required: true,
    },
    severity: {
      type: String,
      enum: ["low", "medium", "high", "critical"],
      default: "high",
    },
    state: {
      type: String,
      enum: ["ok", "warning", "alert", "no_data"],
      default: "ok",
      index: true,
    },
    enabled: {
      type: Boolean,
      default: true,
      index: true,
    },
    condition: {
      type: monitorConditionSchema,
      required: true,
    },
    evaluationIntervalSeconds: {
      type: Number,
      default: 60,
      min: 10,
      max: 3600,
    },
    lastEvaluatedAt: {
      type: Date,
      default: null,
    },
    lastStateChangeAt: {
      type: Date,
      default: null,
    },
    lastEvaluatedValue: {
      type: Number,
      default: null,
    },
    lastEvaluationMessage: {
      type: String,
      default: null,
    },
    tags: {
      type: [String],
      default: [],
    },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

monitorSchema.index({ projectId: 1, enabled: 1 });
monitorSchema.index({ projectId: 1, ruleType: 1 });
monitorSchema.index({ projectId: 1, updatedAt: -1 });

export const MonitorModel: Model<MonitorDocument> =
  mongoose.models.Monitor || mongoose.model<MonitorDocument>("Monitor", monitorSchema);
