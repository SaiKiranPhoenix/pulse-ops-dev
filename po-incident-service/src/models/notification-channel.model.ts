import mongoose, { Schema, type Document, type Model } from "mongoose";
import type {
  MonitorRuleType,
  MonitorSeverity,
  NotificationChannelConfig,
  NotificationChannelType,
} from "@pulseops/shared";

export interface NotificationChannelDocument extends Document {
  projectId: string;
  name: string;
  type: NotificationChannelType;
  config: NotificationChannelConfig;
  enabled: boolean;
  lastDispatchedAt?: Date | null;
  lastDispatchStatus?: "success" | "failed" | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface NotificationRoutingRuleDocument extends Document {
  projectId: string;
  name: string;
  channelIds: string[];
  matchers: {
    service?: string;
    environment?: string;
    severities?: MonitorSeverity[];
    ruleTypes?: MonitorRuleType[];
  };
  enabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export const notificationChannelSchema = new Schema<NotificationChannelDocument>(
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
    type: {
      type: String,
      enum: ["email", "webhook", "slack"],
      required: true,
    },
    config: {
      emailRecipients: { type: [String], default: undefined },
      smtpHost: { type: String, trim: true },
      smtpPort: { type: Number },
      webhookUrl: { type: String, trim: true },
      webhookSecret: { type: String, trim: true },
      slackWebhookUrl: { type: String, trim: true },
      channelName: { type: String, trim: true },
    },
    enabled: {
      type: Boolean,
      default: true,
    },
    lastDispatchedAt: {
      type: Date,
      default: null,
    },
    lastDispatchStatus: {
      type: String,
      enum: ["success", "failed"],
      default: null,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

export const notificationRoutingRuleSchema = new Schema<NotificationRoutingRuleDocument>(
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
    channelIds: {
      type: [String],
      required: true,
    },
    matchers: {
      service: { type: String, trim: true },
      environment: { type: String, trim: true },
      severities: { type: [String], default: undefined },
      ruleTypes: { type: [String], default: undefined },
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

export const NotificationChannelModel: Model<NotificationChannelDocument> =
  mongoose.models.NotificationChannel ||
  mongoose.model<NotificationChannelDocument>("NotificationChannel", notificationChannelSchema);

export const NotificationRoutingRuleModel: Model<NotificationRoutingRuleDocument> =
  mongoose.models.NotificationRoutingRule ||
  mongoose.model<NotificationRoutingRuleDocument>(
    "NotificationRoutingRule",
    notificationRoutingRuleSchema,
  );
