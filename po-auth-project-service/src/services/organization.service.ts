import {
  canManageMembers,
  conflict,
  forbidden,
  type OrganizationRole,
  type ProjectPermission,
  type ProtectedEnvironment,
} from "@pulseops/shared";
import { isDuplicateKeyError } from "../repositories/user.repository.js";
import type {
  OrganizationMemberRepository,
  SafeOrganizationMemberRecord,
} from "../repositories/organization-member.repository.js";
import type {
  OrganizationRepository,
  SafeOrganizationRecord,
} from "../repositories/organization.repository.js";
import type { AuthEvent, AuthEventLogger } from "./auth-event-logger.service.js";

export type OrganizationDto = {
  readonly id: string;
  readonly name: string;
  readonly slug: string;
  readonly role: OrganizationRole;
  readonly createdAt: string;
  readonly updatedAt: string;
};

export type OrganizationMemberDto = {
  readonly id: string;
  readonly organizationId: string;
  readonly userId: string | null;
  readonly email: string;
  readonly displayName: string | null;
  readonly role: OrganizationRole;
  readonly status: SafeOrganizationMemberRecord["status"];
  readonly projectRoles: Array<{
    readonly projectId: string;
    readonly permission: ProjectPermission;
  }>;
  readonly environmentPermissions: Array<{
    readonly environment: ProtectedEnvironment;
    readonly canRead: boolean;
    readonly canWrite: boolean;
    readonly canRevealSecrets: boolean;
  }>;
  readonly createdAt: string;
  readonly updatedAt: string;
};

export type UserWorkspace = {
  readonly organization: SafeOrganizationRecord;
  readonly membership: SafeOrganizationMemberRecord;
};

export class OrganizationService {
  constructor(
    private readonly organizations: OrganizationRepository,
    private readonly members: OrganizationMemberRepository,
    private readonly authEvents?: AuthEventLogger,
  ) {}

  async create(input: {
    readonly userId: string;
    readonly email: string;
    readonly name?: string | null;
    readonly organizationName: string;
    readonly slug?: string | undefined;
  }): Promise<OrganizationDto> {
    const name = normalizeName(input.organizationName);
    const slug = input.slug === undefined ? createSlug(name) : normalizeSlug(input.slug);

    if ((await this.organizations.findBySlug(slug)) !== null) {
      throw conflict("Organization slug is already in use");
    }

    try {
      const organization = await this.organizations.create({
        createdByUserId: input.userId,
        name,
        slug,
      });
      const membership = await this.members.upsert({
        organizationId: organization.id,
        userId: input.userId,
        email: normalizeEmail(input.email),
        displayName: normalizeDisplayName(input.name),
        role: "owner",
        status: "active",
        invitedByUserId: null,
      });
      this.recordMemberEvent("organization.create", input.userId, organization.id);
      return toOrganizationDto(organization, membership.role);
    } catch (error) {
      if (isDuplicateKeyError(error)) {
        throw conflict("Organization slug is already in use");
      }

      throw error;
    }
  }

  async ensureDefaultWorkspace(input: {
    readonly userId: string;
    readonly email: string;
    readonly name?: string | null;
  }): Promise<UserWorkspace> {
    const activeMemberships = await this.members.findActiveByUser(input.userId);
    const existingMembership = activeMemberships[0] ?? null;

    if (existingMembership !== null) {
      const organization = await this.organizations.findById(existingMembership.organizationId);

      if (organization !== null) {
        return { organization, membership: existingMembership };
      }
    }

    const organizationName =
      normalizeDisplayName(input.name) ?? `${normalizeEmail(input.email).split("@")[0]} workspace`;
    const organization = await this.create({
      userId: input.userId,
      email: input.email,
      name: input.name ?? null,
      organizationName,
      slug: `${createSlug(organizationName)}-${input.userId.slice(-6)}`,
    });
    const createdOrganization = await this.organizations.findById(organization.id);
    const membership = await this.members.findActiveMembership(organization.id, input.userId);

    if (createdOrganization === null || membership === null) {
      throw conflict("Default organization could not be initialized");
    }

    return { organization: createdOrganization, membership };
  }

  async listForUser(input: {
    readonly userId: string;
    readonly email: string;
    readonly name?: string | null;
  }): Promise<OrganizationDto[]> {
    await this.ensureDefaultWorkspace(input);
    const memberships = await this.members.findActiveByUser(input.userId);
    const organizations = await Promise.all(
      memberships.map(async (membership) => ({
        membership,
        organization: await this.organizations.findById(membership.organizationId),
      })),
    );

    return organizations
      .filter(
        (
          entry,
        ): entry is {
          membership: SafeOrganizationMemberRecord;
          organization: SafeOrganizationRecord;
        } => entry.organization !== null,
      )
      .map((entry) => toOrganizationDto(entry.organization, entry.membership.role));
  }

  async listMembers(userId: string, organizationId: string): Promise<OrganizationMemberDto[]> {
    await this.requireMembership(userId, organizationId);
    const members = await this.members.findByOrganization(organizationId);
    return members.map(toMemberDto);
  }

  async inviteMember(input: {
    readonly actorUserId: string;
    readonly organizationId: string;
    readonly email: string;
    readonly role: OrganizationRole;
    readonly displayName?: string | null | undefined;
  }): Promise<OrganizationMemberDto> {
    await this.requireManager(input.actorUserId, input.organizationId);
    const member = await this.members.upsert({
      organizationId: input.organizationId,
      userId: null,
      email: normalizeEmail(input.email),
      displayName: normalizeDisplayName(input.displayName),
      role: input.role,
      status: "invited",
      invitedByUserId: input.actorUserId,
    });
    this.recordMemberEvent("organization.member.invite", input.actorUserId, input.organizationId);
    return toMemberDto(member);
  }

  async updateMemberRole(input: {
    readonly actorUserId: string;
    readonly organizationId: string;
    readonly memberId: string;
    readonly role: OrganizationRole;
  }): Promise<OrganizationMemberDto> {
    await this.requireManager(input.actorUserId, input.organizationId);
    const member = await this.members.updateRole(input.organizationId, input.memberId, input.role);

    if (member === null) {
      throw forbidden("Organization member not found");
    }

    this.recordMemberEvent(
      "organization.member.role_update",
      input.actorUserId,
      input.organizationId,
    );
    return toMemberDto(member);
  }

  async setProjectRole(input: {
    readonly actorUserId: string;
    readonly organizationId: string;
    readonly memberId: string;
    readonly projectId: string;
    readonly permission: ProjectPermission | null;
  }): Promise<OrganizationMemberDto> {
    await this.requireManager(input.actorUserId, input.organizationId);
    const member = await this.members.setProjectRole(
      input.organizationId,
      input.memberId,
      input.projectId,
      input.permission,
    );

    if (member === null) {
      throw forbidden("Organization member not found");
    }

    this.recordMemberEvent(
      "organization.member.project_role",
      input.actorUserId,
      input.organizationId,
    );
    return toMemberDto(member);
  }

  async setEnvironmentPermission(input: {
    readonly actorUserId: string;
    readonly organizationId: string;
    readonly memberId: string;
    readonly environment: ProtectedEnvironment;
    readonly canRead: boolean;
    readonly canWrite: boolean;
    readonly canRevealSecrets: boolean;
  }): Promise<OrganizationMemberDto> {
    await this.requireManager(input.actorUserId, input.organizationId);
    const member = await this.members.setEnvironmentPermission(
      input.organizationId,
      input.memberId,
      input.environment,
      {
        canRead: input.canRead,
        canWrite: input.canWrite,
        canRevealSecrets: input.canRevealSecrets,
      },
    );

    if (member === null) {
      throw forbidden("Organization member not found");
    }

    this.recordMemberEvent(
      "organization.member.environment_permission",
      input.actorUserId,
      input.organizationId,
    );
    return toMemberDto(member);
  }

  async removeMember(input: {
    readonly actorUserId: string;
    readonly organizationId: string;
    readonly memberId: string;
  }): Promise<OrganizationMemberDto> {
    await this.requireManager(input.actorUserId, input.organizationId);
    const member = await this.members.remove(input.organizationId, input.memberId);

    if (member === null) {
      throw forbidden("Organization member not found");
    }

    this.recordMemberEvent("organization.member.remove", input.actorUserId, input.organizationId);
    return toMemberDto(member);
  }

  async requireMembership(
    userId: string,
    organizationId: string,
  ): Promise<SafeOrganizationMemberRecord> {
    const membership = await this.members.findActiveMembership(organizationId, userId);

    if (membership === null) {
      throw forbidden("Organization access denied");
    }

    return membership;
  }

  async requireManager(
    userId: string,
    organizationId: string,
  ): Promise<SafeOrganizationMemberRecord> {
    const membership = await this.requireMembership(userId, organizationId);

    if (!canManageMembers(membership.role)) {
      throw forbidden("Organization admin access required");
    }

    return membership;
  }

  private recordMemberEvent(
    action: AuthEvent["action"],
    userId: string,
    organizationId: string,
  ): void {
    this.authEvents?.record({
      action,
      status: "success",
      userId,
      metadata: { organizationId },
    });
  }
}

function toOrganizationDto(
  organization: SafeOrganizationRecord,
  role: OrganizationRole,
): OrganizationDto {
  return {
    id: organization.id,
    name: organization.name,
    slug: organization.slug,
    role,
    createdAt: organization.createdAt.toISOString(),
    updatedAt: organization.updatedAt.toISOString(),
  };
}

function toMemberDto(member: SafeOrganizationMemberRecord): OrganizationMemberDto {
  return {
    id: member.id,
    organizationId: member.organizationId,
    userId: member.userId,
    email: member.email,
    displayName: member.displayName,
    role: member.role,
    status: member.status,
    projectRoles: member.projectRoles.map((role) => ({ ...role })),
    environmentPermissions: member.environmentPermissions.map((permission) => ({
      ...permission,
    })),
    createdAt: member.createdAt.toISOString(),
    updatedAt: member.updatedAt.toISOString(),
  };
}

function normalizeName(name: string): string {
  return name.trim();
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function normalizeDisplayName(name: string | null | undefined): string | null {
  const normalized = name?.trim();
  return normalized === undefined || normalized.length === 0 ? null : normalized;
}

function normalizeSlug(slug: string): string {
  return slug
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
}

function createSlug(name: string): string {
  return normalizeSlug(name);
}
