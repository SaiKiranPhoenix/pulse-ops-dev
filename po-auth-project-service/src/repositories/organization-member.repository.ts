import type { OrganizationRole, ProjectPermission, ProtectedEnvironment } from "@pulseops/shared";
import {
  OrganizationMemberModel,
  type EnvironmentPermission,
  type OrganizationMemberDocument,
  type OrganizationMemberRecord,
  type ProjectRoleOverride,
} from "../models/organization-member.model.js";

export type UpsertOrganizationMemberInput = {
  readonly organizationId: string;
  readonly userId: string | null;
  readonly email: string;
  readonly displayName: string | null;
  readonly role: OrganizationRole;
  readonly status: OrganizationMemberRecord["status"];
  readonly invitedByUserId: string | null;
};

export type SafeOrganizationMemberRecord = {
  readonly id: string;
  readonly organizationId: string;
  readonly userId: string | null;
  readonly email: string;
  readonly displayName: string | null;
  readonly role: OrganizationRole;
  readonly status: OrganizationMemberRecord["status"];
  readonly invitedByUserId: string | null;
  readonly projectRoles: ProjectRoleOverride[];
  readonly environmentPermissions: EnvironmentPermission[];
  readonly createdAt: Date;
  readonly updatedAt: Date;
};

export interface OrganizationMemberRepository {
  upsert(input: UpsertOrganizationMemberInput): Promise<SafeOrganizationMemberRecord>;
  findActiveMembership(
    organizationId: string,
    userId: string,
  ): Promise<SafeOrganizationMemberRecord | null>;
  findActiveByUser(userId: string): Promise<SafeOrganizationMemberRecord[]>;
  findByOrganization(organizationId: string): Promise<SafeOrganizationMemberRecord[]>;
  updateRole(
    organizationId: string,
    memberId: string,
    role: OrganizationRole,
  ): Promise<SafeOrganizationMemberRecord | null>;
  setProjectRole(
    organizationId: string,
    memberId: string,
    projectId: string,
    permission: ProjectPermission | null,
  ): Promise<SafeOrganizationMemberRecord | null>;
  setEnvironmentPermission(
    organizationId: string,
    memberId: string,
    environment: ProtectedEnvironment,
    permission: {
      readonly canRead: boolean;
      readonly canWrite: boolean;
      readonly canRevealSecrets: boolean;
    },
  ): Promise<SafeOrganizationMemberRecord | null>;
  remove(organizationId: string, memberId: string): Promise<SafeOrganizationMemberRecord | null>;
}

export class MongoOrganizationMemberRepository implements OrganizationMemberRepository {
  async upsert(input: UpsertOrganizationMemberInput): Promise<SafeOrganizationMemberRecord> {
    const member = await OrganizationMemberModel.findOneAndUpdate(
      { organizationId: input.organizationId, email: input.email },
      {
        $set: {
          userId: input.userId,
          displayName: input.displayName,
          role: input.role,
          status: input.status,
          invitedByUserId: input.invitedByUserId,
        },
        $setOnInsert: {
          projectRoles: [],
          environmentPermissions: [],
        },
      },
      { new: true, upsert: true },
    ).exec();
    return toSafeOrganizationMemberRecord(member);
  }

  async findActiveMembership(
    organizationId: string,
    userId: string,
  ): Promise<SafeOrganizationMemberRecord | null> {
    const member = await OrganizationMemberModel.findOne({
      organizationId,
      userId,
      status: "active",
    }).exec();
    return member === null ? null : toSafeOrganizationMemberRecord(member);
  }

  async findActiveByUser(userId: string): Promise<SafeOrganizationMemberRecord[]> {
    const members = await OrganizationMemberModel.find({ userId, status: "active" })
      .sort({ createdAt: 1 })
      .exec();
    return members.map(toSafeOrganizationMemberRecord);
  }

  async findByOrganization(organizationId: string): Promise<SafeOrganizationMemberRecord[]> {
    const members = await OrganizationMemberModel.find({
      organizationId,
      status: { $ne: "removed" },
    })
      .sort({ role: 1, email: 1 })
      .exec();
    return members.map(toSafeOrganizationMemberRecord);
  }

  async updateRole(
    organizationId: string,
    memberId: string,
    role: OrganizationRole,
  ): Promise<SafeOrganizationMemberRecord | null> {
    const member = await OrganizationMemberModel.findOneAndUpdate(
      { _id: memberId, organizationId, status: { $ne: "removed" } },
      { $set: { role } },
      { new: true },
    ).exec();
    return member === null ? null : toSafeOrganizationMemberRecord(member);
  }

  async setProjectRole(
    organizationId: string,
    memberId: string,
    projectId: string,
    permission: ProjectPermission | null,
  ): Promise<SafeOrganizationMemberRecord | null> {
    const current = await OrganizationMemberModel.findOne({
      _id: memberId,
      organizationId,
      status: { $ne: "removed" },
    }).exec();

    if (current === null) {
      return null;
    }

    const projectRoles = current.projectRoles.filter((role) => role.projectId !== projectId);
    if (permission !== null) {
      projectRoles.push({ projectId, permission });
    }
    current.projectRoles = projectRoles;
    await current.save();
    return toSafeOrganizationMemberRecord(current);
  }

  async setEnvironmentPermission(
    organizationId: string,
    memberId: string,
    environment: ProtectedEnvironment,
    permission: {
      readonly canRead: boolean;
      readonly canWrite: boolean;
      readonly canRevealSecrets: boolean;
    },
  ): Promise<SafeOrganizationMemberRecord | null> {
    const current = await OrganizationMemberModel.findOne({
      _id: memberId,
      organizationId,
      status: { $ne: "removed" },
    }).exec();

    if (current === null) {
      return null;
    }

    current.environmentPermissions = [
      ...current.environmentPermissions.filter((entry) => entry.environment !== environment),
      { environment, ...permission },
    ];
    await current.save();
    return toSafeOrganizationMemberRecord(current);
  }

  async remove(
    organizationId: string,
    memberId: string,
  ): Promise<SafeOrganizationMemberRecord | null> {
    const member = await OrganizationMemberModel.findOneAndUpdate(
      { _id: memberId, organizationId, status: { $ne: "removed" } },
      { $set: { status: "removed" } },
      { new: true },
    ).exec();
    return member === null ? null : toSafeOrganizationMemberRecord(member);
  }
}

export function toSafeOrganizationMemberRecord(
  member: OrganizationMemberDocument,
): SafeOrganizationMemberRecord {
  return {
    id: member.id,
    organizationId: member.organizationId,
    userId: member.userId,
    email: member.email,
    displayName: member.displayName,
    role: member.role,
    status: member.status,
    invitedByUserId: member.invitedByUserId,
    projectRoles: member.projectRoles.map((role) => ({ ...role })),
    environmentPermissions: member.environmentPermissions.map((permission) => ({
      ...permission,
    })),
    createdAt: member.createdAt,
    updatedAt: member.updatedAt,
  };
}
