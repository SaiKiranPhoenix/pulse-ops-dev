import mongoose, { Schema, type Document, type Model } from "mongoose";
import type { DashboardWidget } from "@pulseops/shared";

export interface CustomDashboardDocument extends Document {
  projectId: string;
  name: string;
  description?: string;
  templateKey?: string;
  widgets: DashboardWidget[];
  tags: string[];
  refreshIntervalSeconds: number;
  isDefault: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const dashboardGridPosSchema = new Schema(
  {
    x: { type: Number, required: true, default: 0 },
    y: { type: Number, required: true, default: 0 },
    w: { type: Number, required: true, default: 6 },
    h: { type: Number, required: true, default: 4 },
  },
  { _id: false },
);

const dashboardWidgetConfigSchema = new Schema(
  {
    metricName: { type: String, trim: true },
    serviceName: { type: String, trim: true },
    environment: { type: String, trim: true },
    queryFilter: { type: String, trim: true },
    timeRange: { type: String, trim: true },
    chartType: { type: String, enum: ["line", "area", "bar"] },
    unit: { type: String, trim: true },
    markdownContent: { type: String },
    topLimit: { type: Number },
    groupBy: { type: String, trim: true },
  },
  { _id: false },
);

const dashboardWidgetSchema = new Schema(
  {
    id: { type: String, required: true },
    type: {
      type: String,
      required: true,
      enum: [
        "timeseries",
        "toplist",
        "table",
        "query_value",
        "incident_list",
        "log_stream",
        "markdown",
      ],
    },
    title: { type: String, required: true, trim: true },
    gridPos: { type: dashboardGridPosSchema, required: true },
    config: { type: dashboardWidgetConfigSchema, default: {} },
  },
  { _id: false },
);

const customDashboardSchema = new Schema<CustomDashboardDocument>(
  {
    projectId: { type: String, required: true, index: true },
    name: { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    templateKey: { type: String, trim: true },
    widgets: { type: [dashboardWidgetSchema], default: [] },
    tags: { type: [String], default: [] },
    refreshIntervalSeconds: { type: Number, default: 30 },
    isDefault: { type: Boolean, default: false },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

customDashboardSchema.index({ projectId: 1, isDefault: 1 });

export const CustomDashboardModel: Model<CustomDashboardDocument> =
  (mongoose.models.CustomDashboard as Model<CustomDashboardDocument>) ||
  mongoose.model<CustomDashboardDocument>("CustomDashboard", customDashboardSchema);
