import mongoose, { Schema, type Document, type Model } from "mongoose";
import type { SliDefinition, SloCalculation, SloHistoryPoint, SloTarget } from "@pulseops/shared";

export interface SloDocument extends Document {
  projectId: string;
  name: string;
  description?: string;
  sli: SliDefinition;
  target: SloTarget;
  tags: string[];
  enabled: boolean;
  calculation?: SloCalculation | null;
  history: SloHistoryPoint[];
  createdAt: Date;
  updatedAt: Date;
}

const sliDefinitionSchema = new Schema(
  {
    type: {
      type: String,
      required: true,
      enum: ["availability", "latency", "error_rate", "custom_metric"],
    },
    serviceName: { type: String, trim: true },
    environment: { type: String, trim: true },
    thresholdMs: { type: Number },
    metricName: { type: String, trim: true },
    goodEventFilter: { type: String, trim: true },
    totalEventFilter: { type: String, trim: true },
  },
  { _id: false },
);

const sloTargetSchema = new Schema(
  {
    targetPercent: { type: Number, required: true, min: 80, max: 99.999 },
    warningPercent: { type: Number, min: 80, max: 99.999 },
    rollingWindowDays: { type: Number, required: true, default: 30 },
  },
  { _id: false },
);

const sloCalculationSchema = new Schema(
  {
    currentSliPercent: { type: Number, required: true },
    errorBudgetTotalPercent: { type: Number, required: true },
    errorBudgetRemainingPercent: { type: Number, required: true },
    errorBudgetConsumedPercent: { type: Number, required: true },
    burnRate1h: { type: Number, required: true, default: 0 },
    burnRate6h: { type: Number, required: true, default: 0 },
    burnRate24h: { type: Number, required: true, default: 0 },
    estimatedHoursToDepletion: { type: Number, default: null },
    status: {
      type: String,
      required: true,
      enum: ["compliant", "at_risk", "breached"],
      default: "compliant",
    },
    totalEventsCount: { type: Number, required: true, default: 0 },
    goodEventsCount: { type: Number, required: true, default: 0 },
    badEventsCount: { type: Number, required: true, default: 0 },
    evaluatedAt: { type: String, required: true },
  },
  { _id: false },
);

const sloHistoryPointSchema = new Schema(
  {
    timestamp: { type: String, required: true },
    sliPercent: { type: Number, required: true },
    remainingBudgetPercent: { type: Number, required: true },
    burnRate1h: { type: Number, required: true },
    status: {
      type: String,
      required: true,
      enum: ["compliant", "at_risk", "breached"],
    },
  },
  { _id: false },
);

const sloSchema = new Schema<SloDocument>(
  {
    projectId: { type: String, required: true, index: true },
    name: { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    sli: { type: sliDefinitionSchema, required: true },
    target: { type: sloTargetSchema, required: true },
    tags: { type: [String], default: [] },
    enabled: { type: Boolean, default: true, index: true },
    calculation: { type: sloCalculationSchema, default: null },
    history: { type: [sloHistoryPointSchema], default: [] },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

sloSchema.index({ projectId: 1, enabled: 1 });
sloSchema.index({ projectId: 1, "sli.serviceName": 1 });
sloSchema.index({ projectId: 1, "sli.environment": 1 });

export const SloModel: Model<SloDocument> =
  (mongoose.models.Slo as Model<SloDocument>) || mongoose.model<SloDocument>("Slo", sloSchema);
