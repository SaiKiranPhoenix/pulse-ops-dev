import mongoose, { Schema, type Document, type Model } from "mongoose";
import type { MonitorRuleType, MonitorSeverity } from "@pulseops/shared";

export interface SilenceWindowDocument extends Document {
  projectId: string;
  name: string;
  matchers: {
    serviceName?: string;
    environment?: string;
    ruleType?: MonitorRuleType;
    monitorId?: string;
    severity?: MonitorSeverity;
  };
  startsAt: Date;
  endsAt: Date;
  reason: string;
  createdBy?: string;
  enabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface MaintenanceWindowDocument extends Document {
  projectId: string;
  name: string;
  services: string[];
  environments: string[];
  startsAt: Date;
  endsAt: Date;
  suppressIncidents: boolean;
  suppressNotifications: boolean;
  reason: string;
  createdAt: Date;
  updatedAt: Date;
}

export const silenceWindowSchema = new Schema<SilenceWindowDocument>(
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
    matchers: {
      serviceName: { type: String, trim: true },
      environment: { type: String, trim: true },
      ruleType: { type: String },
      monitorId: { type: String },
      severity: { type: String },
    },
    startsAt: {
      type: Date,
      required: true,
    },
    endsAt: {
      type: Date,
      required: true,
    },
    reason: {
      type: String,
      required: true,
      trim: true,
    },
    createdBy: {
      type: String,
      trim: true,
    },
    enabled: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

silenceWindowSchema.index({ projectId: 1, endsAt: 1, enabled: 1 });

export const maintenanceWindowSchema = new Schema<MaintenanceWindowDocument>(
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
    services: {
      type: [String],
      default: [],
    },
    environments: {
      type: [String],
      default: [],
    },
    startsAt: {
      type: Date,
      required: true,
    },
    endsAt: {
      type: Date,
      required: true,
    },
    suppressIncidents: {
      type: Boolean,
      default: true,
    },
    suppressNotifications: {
      type: Boolean,
      default: true,
    },
    reason: {
      type: String,
      required: true,
      trim: true,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

maintenanceWindowSchema.index({ projectId: 1, endsAt: 1 });

export const SilenceWindowModel: Model<SilenceWindowDocument> =
  mongoose.models.SilenceWindow ||
  mongoose.model<SilenceWindowDocument>("SilenceWindow", silenceWindowSchema);

export const MaintenanceWindowModel: Model<MaintenanceWindowDocument> =
  mongoose.models.MaintenanceWindow ||
  mongoose.model<MaintenanceWindowDocument>("MaintenanceWindow", maintenanceWindowSchema);
