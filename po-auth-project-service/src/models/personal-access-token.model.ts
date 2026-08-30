import mongoose, { Schema, model, type HydratedDocument, type Model } from "mongoose";

export type PersonalAccessTokenStatus = "active" | "revoked";

export type PersonalAccessTokenRecord = {
  userId: string;
  organizationId: string;
  name: string;
  tokenPrefix: string;
  tokenHash: string;
  scopes: string[];
  status: PersonalAccessTokenStatus;
  lastUsedAt: Date | null;
  expiresAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export type PersonalAccessTokenDocument = HydratedDocument<PersonalAccessTokenRecord>;

const personalAccessTokenSchema = new Schema<PersonalAccessTokenRecord>(
  {
    userId: { type: String, required: true, index: true },
    organizationId: { type: String, required: true, index: true },
    name: { type: String, required: true, trim: true, maxlength: 100 },
    tokenPrefix: { type: String, required: true, trim: true, maxlength: 16 },
    tokenHash: { type: String, required: true, unique: true },
    scopes: { type: [String], default: [] },
    status: {
      type: String,
      enum: ["active", "revoked"],
      default: "active",
      required: true,
      index: true,
    },
    lastUsedAt: { type: Date, default: null },
    expiresAt: { type: Date, default: null },
  },
  {
    collection: "auth_personal_access_tokens",
    timestamps: true,
    versionKey: false,
  },
);

personalAccessTokenSchema.index(
  { userId: 1, organizationId: 1, status: 1, createdAt: -1 },
  { name: "idx_auth_pats_user_org_status_created" },
);

export const PersonalAccessTokenModel: Model<PersonalAccessTokenRecord> =
  mongoose.models.PersonalAccessToken ??
  model<PersonalAccessTokenRecord>("PersonalAccessToken", personalAccessTokenSchema);
