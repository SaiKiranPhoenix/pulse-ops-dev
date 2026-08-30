import { conflict, forbidden, notFound } from "@pulseops/shared";
import { PROJECT_LIMITS } from "../config/constants.js";
import { isDuplicateKeyError } from "../repositories/user.repository.js";
import type { ProjectRepository, SafeProjectRecord } from "../repositories/project.repository.js";
import type { OrganizationMemberRepository } from "../repositories/organization-member.repository.js";
import type { OrganizationService } from "./organization.service.js";

export type CreateProjectInput = {
  readonly ownerId: string;
  readonly ownerEmail: string;
  readonly ownerName?: string | null;
  readonly organizationId?: string | null;
  readonly name: string;
  readonly slug?: string | undefined;
  readonly description?: string | null | undefined;
};

export type ProjectDto = {
  readonly id: string;
  readonly organizationId: string | null;
  readonly name: string;
  readonly slug: string;
  readonly description: string | null;
  readonly status: SafeProjectRecord["status"];
  readonly createdAt: string;
  readonly updatedAt: string;
};

export class ProjectService {
  constructor(
    private readonly projects: ProjectRepository,
    private readonly organizations?: OrganizationService,
    private readonly members?: OrganizationMemberRepository,
  ) {}

  async create(input: CreateProjectInput): Promise<ProjectDto> {
    const workspace = await this.resolveProjectWorkspace(input);
    const name = normalizeName(input.name);
    const slug = input.slug === undefined ? createSlug(name) : normalizeSlug(input.slug);
    const existingProject =
      workspace.organizationId === null
        ? await this.projects.findBySlugForOwner(slug, input.ownerId)
        : await this.projects.findBySlugForOrganization(slug, workspace.organizationId);

    if (existingProject !== null) {
      throw conflict("Project slug is already in use");
    }

    try {
      const project = await this.projects.create({
        ownerId: input.ownerId,
        organizationId: workspace.organizationId,
        name,
        slug,
        description: normalizeDescription(input.description),
      });
      return toProjectDto(project);
    } catch (error) {
      if (isDuplicateKeyError(error)) {
        throw conflict("Project slug is already in use");
      }

      throw error;
    }
  }

  async list(input: {
    readonly userId: string;
    readonly email: string;
    readonly name?: string | null;
    readonly organizationId?: string | null;
  }): Promise<ProjectDto[]> {
    const organizationIds = await this.resolveOrganizationIds(input);
    const projects = await this.projects.findByOrganizationIds(organizationIds, input.userId);
    return projects.map(toProjectDto);
  }

  async get(projectId: string, userId: string): Promise<ProjectDto> {
    const project = await this.findAccessibleProject(projectId, userId);

    if (project === null) {
      throw notFound("Project not found");
    }

    return toProjectDto(project);
  }

  async archive(projectId: string, ownerId: string): Promise<ProjectDto> {
    return this.changeStatus(projectId, ownerId, "archived");
  }

  async restore(projectId: string, ownerId: string): Promise<ProjectDto> {
    return this.changeStatus(projectId, ownerId, "active");
  }

  private async changeStatus(
    projectId: string,
    ownerId: string,
    status: SafeProjectRecord["status"],
  ): Promise<ProjectDto> {
    const projectToChange = await this.findAccessibleProject(projectId, ownerId);

    if (projectToChange === null) {
      throw notFound("Project not found");
    }

    if (projectToChange.ownerId !== ownerId) {
      const membership = await this.findProjectMembership(projectToChange, ownerId);

      if (membership === null || (membership.role !== "owner" && membership.role !== "admin")) {
        throw forbidden("Project admin access required");
      }
    }

    const project = await this.projects.updateStatus(projectId, ownerId, status);

    if (project === null) {
      throw notFound("Project not found");
    }

    return toProjectDto(project);
  }

  private async resolveProjectWorkspace(input: CreateProjectInput): Promise<{
    readonly organizationId: string | null;
  }> {
    if (this.organizations === undefined || this.members === undefined) {
      return { organizationId: null };
    }

    if (input.organizationId !== undefined && input.organizationId !== null) {
      const membership = await this.organizations.requireMembership(
        input.ownerId,
        input.organizationId,
      );

      if (
        membership.role !== "owner" &&
        membership.role !== "admin" &&
        membership.role !== "developer"
      ) {
        throw forbidden("Project write access required");
      }

      return { organizationId: input.organizationId };
    }

    const workspace = await this.organizations.ensureDefaultWorkspace({
      userId: input.ownerId,
      email: input.ownerEmail,
      name: input.ownerName ?? null,
    });
    return { organizationId: workspace.organization.id };
  }

  private async resolveOrganizationIds(input: {
    readonly userId: string;
    readonly email: string;
    readonly name?: string | null;
    readonly organizationId?: string | null;
  }): Promise<string[]> {
    if (this.organizations === undefined || this.members === undefined) {
      return [];
    }

    await this.organizations.ensureDefaultWorkspace({
      userId: input.userId,
      email: input.email,
      name: input.name ?? null,
    });

    if (input.organizationId !== undefined && input.organizationId !== null) {
      await this.organizations.requireMembership(input.userId, input.organizationId);
      return [input.organizationId];
    }

    const memberships = await this.members.findActiveByUser(input.userId);
    return memberships.map((membership) => membership.organizationId);
  }

  private async findAccessibleProject(
    projectId: string,
    userId: string,
  ): Promise<SafeProjectRecord | null> {
    const project = await this.projects.findById(projectId);

    if (project === null) {
      return null;
    }

    if (project.ownerId === userId) {
      return project;
    }

    const membership = await this.findProjectMembership(project, userId);
    return membership === null ? null : project;
  }

  private async findProjectMembership(
    project: SafeProjectRecord,
    userId: string,
  ): ReturnType<OrganizationMemberRepository["findActiveMembership"]> {
    if (
      this.members === undefined ||
      project.organizationId === null ||
      project.status !== "active"
    ) {
      return Promise.resolve(null);
    }

    return this.members.findActiveMembership(project.organizationId, userId);
  }
}

function normalizeName(name: string): string {
  return name.trim();
}

function normalizeSlug(slug: string): string {
  return slug
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, PROJECT_LIMITS.slugMaxLength);
}

function createSlug(name: string): string {
  return normalizeSlug(name);
}

function normalizeDescription(description: string | null | undefined): string | null {
  if (description === undefined || description === null) {
    return null;
  }

  const normalized = description.trim();
  return normalized.length === 0 ? null : normalized;
}

function toProjectDto(project: SafeProjectRecord): ProjectDto {
  return {
    id: project.id,
    organizationId: project.organizationId,
    name: project.name,
    slug: project.slug,
    description: project.description,
    status: project.status,
    createdAt: project.createdAt.toISOString(),
    updatedAt: project.updatedAt.toISOString(),
  };
}
