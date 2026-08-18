import { conflict, notFound } from "@pulseops/shared";
import { PROJECT_LIMITS } from "../config/constants.js";
import { isDuplicateKeyError } from "../repositories/user.repository.js";
import type { ProjectRepository, SafeProjectRecord } from "../repositories/project.repository.js";

export type CreateProjectInput = {
  readonly ownerId: string;
  readonly name: string;
  readonly slug?: string | undefined;
};

export type ProjectDto = {
  readonly id: string;
  readonly name: string;
  readonly slug: string;
  readonly status: SafeProjectRecord["status"];
  readonly createdAt: string;
  readonly updatedAt: string;
};

export class ProjectService {
  constructor(private readonly projects: ProjectRepository) {}

  async create(input: CreateProjectInput): Promise<ProjectDto> {
    const name = normalizeName(input.name);
    const slug = input.slug === undefined ? createSlug(name) : normalizeSlug(input.slug);
    const existingProject = await this.projects.findBySlugForOwner(slug, input.ownerId);

    if (existingProject !== null) {
      throw conflict("Project slug is already in use");
    }

    try {
      const project = await this.projects.create({ ownerId: input.ownerId, name, slug });
      return toProjectDto(project);
    } catch (error) {
      if (isDuplicateKeyError(error)) {
        throw conflict("Project slug is already in use");
      }

      throw error;
    }
  }

  async list(ownerId: string): Promise<ProjectDto[]> {
    const projects = await this.projects.findByOwner(ownerId);
    return projects.map(toProjectDto);
  }

  async get(projectId: string, ownerId: string): Promise<ProjectDto> {
    const project = await this.projects.findByIdForOwner(projectId, ownerId);

    if (project === null) {
      throw notFound("Project not found");
    }

    return toProjectDto(project);
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

function toProjectDto(project: SafeProjectRecord): ProjectDto {
  return {
    id: project.id,
    name: project.name,
    slug: project.slug,
    status: project.status,
    createdAt: project.createdAt.toISOString(),
    updatedAt: project.updatedAt.toISOString(),
  };
}
