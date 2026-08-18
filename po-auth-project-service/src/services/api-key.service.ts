import { notFound } from "@pulseops/shared";
import { API_KEY_LIMITS } from "../config/constants.js";
import type { ApiKeyRepository, SafeApiKeyRecord } from "../repositories/api-key.repository.js";
import type { ProjectRepository } from "../repositories/project.repository.js";
import type { ApiKeyHasher } from "./api-key-hasher.service.js";

export type CreateApiKeyInput = {
  readonly ownerId: string;
  readonly projectId: string;
  readonly name: string;
  readonly scopes?: string[] | undefined;
  readonly expiresAt?: Date | null | undefined;
};

export type ApiKeyDto = {
  readonly id: string;
  readonly projectId: string;
  readonly name: string;
  readonly keyPrefix: string;
  readonly scopes: string[];
  readonly status: SafeApiKeyRecord["status"];
  readonly lastUsedAt: string | null;
  readonly expiresAt: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
};

export type CreatedApiKeyDto = {
  readonly apiKey: ApiKeyDto;
  readonly rawKey: string;
};

export class ApiKeyService {
  constructor(
    private readonly projects: ProjectRepository,
    private readonly apiKeys: ApiKeyRepository,
    private readonly apiKeyHasher: ApiKeyHasher,
  ) {}

  async create(input: CreateApiKeyInput): Promise<CreatedApiKeyDto> {
    await this.ensureProjectAccess(input.projectId, input.ownerId);

    const generatedKey = this.apiKeyHasher.generate();
    const apiKey = await this.apiKeys.create({
      ownerId: input.ownerId,
      projectId: input.projectId,
      name: input.name.trim(),
      keyPrefix: generatedKey.keyPrefix,
      keyHash: generatedKey.keyHash,
      scopes: normalizeScopes(input.scopes),
      expiresAt: input.expiresAt ?? null,
    });

    return {
      apiKey: toApiKeyDto(apiKey),
      rawKey: generatedKey.rawKey,
    };
  }

  async list(projectId: string, ownerId: string): Promise<ApiKeyDto[]> {
    await this.ensureProjectAccess(projectId, ownerId);
    const apiKeys = await this.apiKeys.findByProject(projectId);
    return apiKeys.map(toApiKeyDto);
  }

  async rotate(apiKeyId: string, projectId: string, ownerId: string): Promise<CreatedApiKeyDto> {
    const existingApiKey = await this.getExistingApiKey(apiKeyId, projectId, ownerId);
    await this.apiKeys.disable(existingApiKey.id, projectId);

    return this.create({
      ownerId,
      projectId,
      name: `${existingApiKey.name} rotated`,
      scopes: existingApiKey.scopes,
      expiresAt: existingApiKey.expiresAt,
    });
  }

  async disable(apiKeyId: string, projectId: string, ownerId: string): Promise<ApiKeyDto> {
    await this.getExistingApiKey(apiKeyId, projectId, ownerId);
    const disabledApiKey = await this.apiKeys.disable(apiKeyId, projectId);

    if (disabledApiKey === null) {
      throw notFound("API key not found");
    }

    return toApiKeyDto(disabledApiKey);
  }

  private async getExistingApiKey(
    apiKeyId: string,
    projectId: string,
    ownerId: string,
  ): Promise<SafeApiKeyRecord> {
    await this.ensureProjectAccess(projectId, ownerId);
    const apiKey = await this.apiKeys.findByIdForProject(apiKeyId, projectId);

    if (apiKey === null) {
      throw notFound("API key not found");
    }

    return apiKey;
  }

  private async ensureProjectAccess(projectId: string, ownerId: string): Promise<void> {
    const project = await this.projects.findByIdForOwner(projectId, ownerId);

    if (project === null) {
      throw notFound("Project not found");
    }
  }
}

function normalizeScopes(scopes: string[] | undefined): string[] {
  const fallback = [...API_KEY_LIMITS.defaultScopes];
  const selectedScopes = scopes === undefined || scopes.length === 0 ? fallback : scopes;
  return [...new Set(selectedScopes)].sort();
}

function toApiKeyDto(apiKey: SafeApiKeyRecord): ApiKeyDto {
  return {
    id: apiKey.id,
    projectId: apiKey.projectId,
    name: apiKey.name,
    keyPrefix: apiKey.keyPrefix,
    scopes: [...apiKey.scopes],
    status: apiKey.status,
    lastUsedAt: apiKey.lastUsedAt?.toISOString() ?? null,
    expiresAt: apiKey.expiresAt?.toISOString() ?? null,
    createdAt: apiKey.createdAt.toISOString(),
    updatedAt: apiKey.updatedAt.toISOString(),
  };
}
