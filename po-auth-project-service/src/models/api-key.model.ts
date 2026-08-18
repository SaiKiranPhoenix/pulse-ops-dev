import { Schema, model, models, type HydratedDocument, type Model } from "mongoose";

export type ApiKeyStatus = "active" | "disabled";

export type ApiKeyRecord = {
  ownerId: string;
  projectId: string;
  name: string;
  keyPrefix: string;
  keyHash: string;
  scopes: string[];
  status: ApiKeyStatus;
  lastUsedAt: Date | null;
  expiresAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export type ApiKeyDocument = HydratedDocument<ApiKeyRecord>;

const apiKeySchema = new Schema<ApiKeyRecord>(
  {
    ownerId: {
      type: String,
      required: true,
      index: true,
    },
    projectId: {
      type: String,
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 80,
    },
    keyPrefix: {
      type: String,
      required: true,
      index: true,
    },
    keyHash: {
      type: String,
      required: true,
      select: false,
      unique: true,
    },
    scopes: {
      type: [String],
      required: true,
      default: [],
    },
    status: {
      type: String,
      enum: ["active", "disabled"],
      default: "active",
      required: true,
      index: true,
    },
    lastUsedAt: {
      type: Date,
      default: null,
    },
    expiresAt: {
      type: Date,
      default: null,
    },
  },
  {
    collection: "auth_api_keys",
    timestamps: true,
    versionKey: false,
  },
);

apiKeySchema.index({ projectId: 1, status: 1 }, { name: "idx_auth_api_keys_project_status" });

export const ApiKeyModel: Model<ApiKeyRecord> =
  models.ApiKey ?? model<ApiKeyRecord>("ApiKey", apiKeySchema);
