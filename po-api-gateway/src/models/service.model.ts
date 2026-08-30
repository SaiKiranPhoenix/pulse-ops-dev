import mongoose, { Schema, model, type HydratedDocument, type Model } from "mongoose";

export type ServiceLanguage =
  "nodejs" | "python" | "go" | "java" | "rust" | "csharp" | "ruby" | "other";

export type ServiceRuntime =
  "docker" | "kubernetes" | "lambda" | "baremetal" | "cloud_run" | "ecs" | "other";

export type ServiceTier = "tier_1" | "tier_2" | "tier_3";

export type ServiceStatus = "active" | "discovered" | "archived";

export type ServiceChecklistItem = {
  id: string;
  title: string;
  completed: boolean;
  completedAt?: Date | null | undefined;
};

export type ServiceRecord = {
  projectId: string;
  name: string;
  displayName: string | null;
  description: string | null;
  ownerName: string | null;
  ownerEmail: string | null;
  ownerTeam: string | null;
  language: ServiceLanguage;
  runtime: ServiceRuntime;
  tier: ServiceTier;
  repoUrl: string | null;
  runbookUrl: string | null;
  deploymentUrl: string | null;
  tags: string[];
  onboardingChecklist: ServiceChecklistItem[];
  isAutoDiscovered: boolean;
  status: ServiceStatus;
  createdAt: Date;
  updatedAt: Date;
};

export type ServiceDocument = HydratedDocument<ServiceRecord>;

const checklistItemSchema = new Schema<ServiceChecklistItem>(
  {
    id: { type: String, required: true },
    title: { type: String, required: true },
    completed: { type: Boolean, required: true, default: false },
    completedAt: { type: Date, default: null },
  },
  { _id: false },
);

const serviceSchema = new Schema<ServiceRecord>(
  {
    projectId: { type: String, required: true, index: true },
    name: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      maxlength: 120,
    },
    displayName: { type: String, default: null, trim: true, maxlength: 160 },
    description: { type: String, default: null, trim: true, maxlength: 2_000 },
    ownerName: { type: String, default: null, trim: true, maxlength: 120 },
    ownerEmail: { type: String, default: null, trim: true, maxlength: 320 },
    ownerTeam: { type: String, default: null, trim: true, maxlength: 120 },
    language: {
      type: String,
      enum: ["nodejs", "python", "go", "java", "rust", "csharp", "ruby", "other"],
      default: "other",
      required: true,
    },
    runtime: {
      type: String,
      enum: ["docker", "kubernetes", "lambda", "baremetal", "cloud_run", "ecs", "other"],
      default: "docker",
      required: true,
    },
    tier: {
      type: String,
      enum: ["tier_1", "tier_2", "tier_3"],
      default: "tier_2",
      required: true,
      index: true,
    },
    repoUrl: { type: String, default: null, trim: true, maxlength: 1_000 },
    runbookUrl: { type: String, default: null, trim: true, maxlength: 1_000 },
    deploymentUrl: { type: String, default: null, trim: true, maxlength: 1_000 },
    tags: { type: [String], default: [], index: true },
    onboardingChecklist: { type: [checklistItemSchema], default: [] },
    isAutoDiscovered: { type: Boolean, default: false },
    status: {
      type: String,
      enum: ["active", "discovered", "archived"],
      default: "active",
      required: true,
      index: true,
    },
  },
  {
    collection: "catalog_services",
    timestamps: true,
    versionKey: false,
  },
);

serviceSchema.index(
  { projectId: 1, name: 1 },
  { unique: true, name: "idx_catalog_project_name_unique" },
);
serviceSchema.index(
  { projectId: 1, status: 1, tier: 1 },
  { name: "idx_catalog_project_status_tier" },
);

export const ServiceModel: Model<ServiceRecord> =
  mongoose.models.CatalogService ?? model<ServiceRecord>("CatalogService", serviceSchema);
