import mongoose, { Schema, model, type HydratedDocument, type Model } from "mongoose";

export type OrganizationRecord = {
  createdByUserId: string;
  name: string;
  slug: string;
  createdAt: Date;
  updatedAt: Date;
};

export type OrganizationDocument = HydratedDocument<OrganizationRecord>;

const organizationSchema = new Schema<OrganizationRecord>(
  {
    createdByUserId: {
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
  },
  {
    collection: "auth_organizations",
    timestamps: true,
    versionKey: false,
  },
);

organizationSchema.index({ slug: 1 }, { unique: true, name: "uniq_auth_orgs_slug" });

export const OrganizationModel: Model<OrganizationRecord> =
  mongoose.models.Organization ?? model<OrganizationRecord>("Organization", organizationSchema);
