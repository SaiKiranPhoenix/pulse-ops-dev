import mongoose, { Schema, model, type HydratedDocument, type Model } from "mongoose";

export type ProjectStatus = "active" | "archived";

export type ProjectRecord = {
  ownerId: string;
  organizationId: string | null;
  name: string;
  slug: string;
  description: string | null;
  status: ProjectStatus;
  createdAt: Date;
  updatedAt: Date;
};

export type ProjectDocument = HydratedDocument<ProjectRecord>;

const projectSchema = new Schema<ProjectRecord>(
  {
    ownerId: {
      type: String,
      required: true,
      index: true,
    },
    organizationId: {
      type: String,
      default: null,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },
    slug: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      maxlength: 80,
    },
    description: {
      type: String,
      default: null,
      trim: true,
      maxlength: 500,
    },
    status: {
      type: String,
      enum: ["active", "archived"],
      default: "active",
      required: true,
      index: true,
    },
  },
  {
    collection: "auth_projects",
    timestamps: true,
    versionKey: false,
  },
);

projectSchema.index(
  { ownerId: 1, slug: 1 },
  { unique: true, name: "uniq_auth_projects_owner_slug" },
);
projectSchema.index(
  { organizationId: 1, slug: 1 },
  {
    unique: true,
    sparse: true,
    name: "uniq_auth_projects_org_slug",
  },
);

export const ProjectModel: Model<ProjectRecord> =
  mongoose.models.Project ?? model<ProjectRecord>("Project", projectSchema);
