import { Schema, model, models, type HydratedDocument, type Model } from "mongoose";

export type ProjectStatus = "active" | "archived";

export type ProjectRecord = {
  ownerId: string;
  name: string;
  slug: string;
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

export const ProjectModel: Model<ProjectRecord> =
  models.Project ?? model<ProjectRecord>("Project", projectSchema);
