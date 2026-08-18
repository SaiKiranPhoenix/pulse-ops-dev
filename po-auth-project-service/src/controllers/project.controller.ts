import type { Request, Response } from "express";
import { successResponse } from "@pulseops/shared";
import { getAuthContext } from "../middlewares/auth.middleware.js";
import type { ApiKeyService } from "../services/api-key.service.js";
import type { ProjectService } from "../services/project.service.js";
import type {
  ApiKeyParams,
  CreateApiKeyBody,
  CreateProjectBody,
  ProjectParams,
} from "../validators/project.validator.js";

export class ProjectController {
  constructor(
    private readonly projects: ProjectService,
    private readonly apiKeys: ApiKeyService,
  ) {}

  create = async (_request: Request, response: Response): Promise<void> => {
    const auth = getAuthContext(response);
    const body = response.locals.validatedBody as CreateProjectBody;
    const project = await this.projects.create({
      ownerId: auth.userId,
      name: body.name,
      slug: body.slug,
    });

    response.status(201).json(successResponse({ project }, String(response.locals.requestId)));
  };

  list = async (_request: Request, response: Response): Promise<void> => {
    const auth = getAuthContext(response);
    const projects = await this.projects.list(auth.userId);

    response.status(200).json(successResponse({ projects }, String(response.locals.requestId)));
  };

  detail = async (_request: Request, response: Response): Promise<void> => {
    const auth = getAuthContext(response);
    const params = response.locals.validatedParams as ProjectParams;
    const project = await this.projects.get(params.projectId, auth.userId);

    response.status(200).json(successResponse({ project }, String(response.locals.requestId)));
  };

  createApiKey = async (_request: Request, response: Response): Promise<void> => {
    const auth = getAuthContext(response);
    const params = response.locals.validatedParams as ProjectParams;
    const body = response.locals.validatedBody as CreateApiKeyBody;
    const apiKey = await this.apiKeys.create({
      ownerId: auth.userId,
      projectId: params.projectId,
      name: body.name,
      scopes: body.scopes,
      expiresAt: body.expiresAt,
    });

    response.status(201).json(successResponse(apiKey, String(response.locals.requestId)));
  };

  listApiKeys = async (_request: Request, response: Response): Promise<void> => {
    const auth = getAuthContext(response);
    const params = response.locals.validatedParams as ProjectParams;
    const apiKeys = await this.apiKeys.list(params.projectId, auth.userId);

    response.status(200).json(successResponse({ apiKeys }, String(response.locals.requestId)));
  };

  rotateApiKey = async (_request: Request, response: Response): Promise<void> => {
    const auth = getAuthContext(response);
    const params = response.locals.validatedParams as ApiKeyParams;
    const apiKey = await this.apiKeys.rotate(params.apiKeyId, params.projectId, auth.userId);

    response.status(200).json(successResponse(apiKey, String(response.locals.requestId)));
  };

  disableApiKey = async (_request: Request, response: Response): Promise<void> => {
    const auth = getAuthContext(response);
    const params = response.locals.validatedParams as ApiKeyParams;
    const apiKey = await this.apiKeys.disable(params.apiKeyId, params.projectId, auth.userId);

    response.status(200).json(successResponse({ apiKey }, String(response.locals.requestId)));
  };
}
