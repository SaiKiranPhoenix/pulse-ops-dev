import mongoose, { Schema, model, type HydratedDocument, type Model } from "mongoose";
import { organizationRoles, projectPermissions, type OrganizationRole } from "@pulseops/shared";

export type OrganizationMemberStatus = "active" | "invited" | "removed";

export type ProjectRoleOverride = {
  projectId: string;
  permission: "read" | "write" | "admin";
};

export type EnvironmentPermission = {
  environment: "development" | "staging" | "production";
  canRead: boolean;
  canWrite: boolean;
  canRevealSecrets: boolean;
};

export type OrganizationMemberRecord = {
  organizationId: string;
  userId: string | null;
  email: string;
  displayName: string | null;
  role: OrganizationRole;
  status: OrganizationMemberStatus;
  invitedByUserId: string | null;
  projectRoles: ProjectRoleOverride[];
  environmentPermissions: EnvironmentPermission[];
  createdAt: Date;
  updatedAt: Date;
};

export type OrganizationMemberDocument = HydratedDocument<OrganizationMemberRecord>;

const projectRoleSchema = new Schema<ProjectRoleOverride>(
  {
    projectId: { type: String, required: true },
    permission: { type: String, enum: projectPermissions, required: true },
  },
  { _id: false },
);

const environmentPermissionSchema = new Schema<EnvironmentPermission>(
  {
    environment: {
      type: String,
      enum: ["development", "staging", "production"],
      required: true,
    },
    canRead: { type: Boolean, required: true, default: true },
    canWrite: { type: Boolean, required: true, default: false },
    canRevealSecrets: { type: Boolean, required: true, default: false },
  },
  { _id: false },
);

const organizationMemberSchema = new Schema<OrganizationMemberRecord>(
  {
    organizationId: { type: String, required: true, index: true },
    userId: { type: String, default: null, index: true },
    email: { type: String, required: true, trim: true, lowercase: true, maxlength: 320 },
    displayName: { type: String, default: null, trim: true, maxlength: 100 },
    role: { type: String, enum: organizationRoles, required: true, index: true },
    status: {
      type: String,
      enum: ["active", "invited", "removed"],
      default: "invited",
      required: true,
      index: true,
    },
    invitedByUserId: { type: String, default: null },
    projectRoles: { type: [projectRoleSchema], default: [] },
    environmentPermissions: { type: [environmentPermissionSchema], default: [] },
  },
  {
    collection: "auth_organization_members",
    timestamps: true,
    versionKey: false,
  },
);

organizationMemberSchema.index(
  { organizationId: 1, email: 1 },
  { unique: true, name: "uniq_auth_org_members_org_email" },
);
organizationMemberSchema.index(
  { organizationId: 1, userId: 1, status: 1 },
  { name: "idx_auth_org_members_user_status" },
);

export const OrganizationMemberModel: Model<OrganizationMemberRecord> =
  mongoose.models.OrganizationMember ??
  model<OrganizationMemberRecord>("OrganizationMember", organizationMemberSchema);
