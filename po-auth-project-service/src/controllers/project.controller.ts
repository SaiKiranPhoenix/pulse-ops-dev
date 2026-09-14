import type { Request, Response } from "express";
import { successResponse } from "@pulseops/shared";
import { getAuthContext } from "../middlewares/auth.middleware.js";
import type { ApiKeyService } from "../services/api-key.service.js";
import type { OrganizationService } from "../services/organization.service.js";
import type { PersonalAccessTokenService } from "../services/personal-access-token.service.js";
import type { ProjectService } from "../services/project.service.js";
import type {
  ApiKeyParams,
  CreateApiKeyBody,
  CreateOrganizationBody,
  CreatePersonalAccessTokenBody,
  CreateProjectBody,
  InviteMemberBody,
  OrganizationMemberEnvironmentParams,
  OrganizationMemberParams,
  OrganizationMemberProjectParams,
  OrganizationParams,
  PersonalAccessTokenParams,
  ProjectParams,
  SetEnvironmentPermissionBody,
  SetProjectRoleBody,
  UpdateMemberRoleBody,
} from "../validators/project.validator.js";

export class ProjectController {
  constructor(
    private readonly projects: ProjectService,
    private readonly apiKeys: ApiKeyService,
    private readonly organizations: OrganizationService,
    private readonly personalAccessTokens: PersonalAccessTokenService,
  ) {}

  create = async (_request: Request, response: Response): Promise<void> => {
    const auth = getAuthContext(response);
    const body = response.locals.validatedBody as CreateProjectBody;
    const project = await this.projects.create({
      ownerId: auth.userId,
      ownerEmail: auth.email,
      ownerName: auth.name,
      organizationId: body.organizationId ?? null,
      name: body.name,
      slug: body.slug,
      description: body.description,
    });

    response.status(201).json(successResponse({ project }, String(response.locals.requestId)));
  };
  list = async (_request: Request, response: Response): Promise<void> => {
    const auth = getAuthContext(response);
    const organizationId =
      typeof _request.query.organizationId === "string" ? _request.query.organizationId : null;
    const projects = await this.projects.list({
      userId: auth.userId,
      email: auth.email,
      name: auth.name,
      organizationId,
    });

    response.status(200).json(successResponse({ projects }, String(response.locals.requestId)));
  };

  detail = async (_request: Request, response: Response): Promise<void> => {
    const auth = getAuthContext(response);
    const params = response.locals.validatedParams as ProjectParams;
    const project = await this.projects.get(params.projectId, auth.userId);

    response.status(200).json(successResponse({ project }, String(response.locals.requestId)));
  };

  archive = async (_request: Request, response: Response): Promise<void> => {
    const auth = getAuthContext(response);
    const params = response.locals.validatedParams as ProjectParams;
    const project = await this.projects.archive(params.projectId, auth.userId);

    response.status(200).json(successResponse({ project }, String(response.locals.requestId)));
  };

  restore = async (_request: Request, response: Response): Promise<void> => {
    const auth = getAuthContext(response);
    const params = response.locals.validatedParams as ProjectParams;
    const project = await this.projects.restore(params.projectId, auth.userId);

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

  createOrganization = async (_request: Request, response: Response): Promise<void> => {
    const auth = getAuthContext(response);
    const body = response.locals.validatedBody as CreateOrganizationBody;
    const organization = await this.organizations.create({
      userId: auth.userId,
      email: auth.email,
      name: auth.name,
      organizationName: body.name,
      slug: body.slug,
    });

    response.status(201).json(successResponse({ organization }, String(response.locals.requestId)));
  };

  listOrganizations = async (_request: Request, response: Response): Promise<void> => {
    const auth = getAuthContext(response);
    const organizations = await this.organizations.listForUser({
      userId: auth.userId,
      email: auth.email,
      name: auth.name,
    });

    response
      .status(200)
      .json(successResponse({ organizations }, String(response.locals.requestId)));
  };

  listOrganizationMembers = async (_request: Request, response: Response): Promise<void> => {
    const auth = getAuthContext(response);
    const params = response.locals.validatedParams as OrganizationParams;
    const members = await this.organizations.listMembers(auth.userId, params.organizationId);

    response.status(200).json(successResponse({ members }, String(response.locals.requestId)));
  };

  inviteOrganizationMember = async (_request: Request, response: Response): Promise<void> => {
    const auth = getAuthContext(response);
    const params = response.locals.validatedParams as OrganizationParams;
    const body = response.locals.validatedBody as InviteMemberBody;
    const member = await this.organizations.inviteMember({
      actorUserId: auth.userId,
      organizationId: params.organizationId,
      email: body.email,
      displayName: body.displayName,
      role: body.role,
    });

    response.status(201).json(successResponse({ member }, String(response.locals.requestId)));
  };

  updateOrganizationMemberRole = async (_request: Request, response: Response): Promise<void> => {
    const auth = getAuthContext(response);
    const params = response.locals.validatedParams as OrganizationMemberParams;
    const body = response.locals.validatedBody as UpdateMemberRoleBody;
    const member = await this.organizations.updateMemberRole({
      actorUserId: auth.userId,
      organizationId: params.organizationId,
      memberId: params.memberId,
      role: body.role,
    });

    response.status(200).json(successResponse({ member }, String(response.locals.requestId)));
  };

  setOrganizationMemberProjectRole = async (
    _request: Request,
    response: Response,
  ): Promise<void> => {
    const auth = getAuthContext(response);
    const params = response.locals.validatedParams as OrganizationMemberProjectParams;
    const body = response.locals.validatedBody as SetProjectRoleBody;
    const member = await this.organizations.setProjectRole({
      actorUserId: auth.userId,
      organizationId: params.organizationId,
      memberId: params.memberId,
      projectId: params.projectId,
      permission: body.permission,
    });

    response.status(200).json(successResponse({ member }, String(response.locals.requestId)));
  };

  setOrganizationMemberEnvironmentPermission = async (
    _request: Request,
    response: Response,
  ): Promise<void> => {
    const auth = getAuthContext(response);
    const params = response.locals.validatedParams as OrganizationMemberEnvironmentParams;
    const body = response.locals.validatedBody as SetEnvironmentPermissionBody;
    const member = await this.organizations.setEnvironmentPermission({
      actorUserId: auth.userId,
      organizationId: params.organizationId,
      memberId: params.memberId,
      environment: params.environment,
      canRead: body.canRead,
      canWrite: body.canWrite,
      canRevealSecrets: body.canRevealSecrets,
    });

    response.status(200).json(successResponse({ member }, String(response.locals.requestId)));
  };

  removeOrganizationMember = async (_request: Request, response: Response): Promise<void> => {
    const auth = getAuthContext(response);
    const params = response.locals.validatedParams as OrganizationMemberParams;
    const member = await this.organizations.removeMember({
      actorUserId: auth.userId,
      organizationId: params.organizationId,
      memberId: params.memberId,
    });

    response.status(200).json(successResponse({ member }, String(response.locals.requestId)));
  };

  createPersonalAccessToken = async (_request: Request, response: Response): Promise<void> => {
    const auth = getAuthContext(response);
    const params = response.locals.validatedParams as OrganizationParams;
    const body = response.locals.validatedBody as CreatePersonalAccessTokenBody;
    const token = await this.personalAccessTokens.create({
      userId: auth.userId,
      organizationId: params.organizationId,
      name: body.name,
      scopes: body.scopes,
      expiresAt: body.expiresAt,
    });

    response.status(201).json(successResponse(token, String(response.locals.requestId)));
  };

  listPersonalAccessTokens = async (_request: Request, response: Response): Promise<void> => {
    const auth = getAuthContext(response);
    const params = response.locals.validatedParams as OrganizationParams;
    const tokens = await this.personalAccessTokens.list(auth.userId, params.organizationId);

    response.status(200).json(successResponse({ tokens }, String(response.locals.requestId)));
  };

  revokePersonalAccessToken = async (_request: Request, response: Response): Promise<void> => {
    const auth = getAuthContext(response);
    const params = response.locals.validatedParams as PersonalAccessTokenParams;
    const token = await this.personalAccessTokens.revoke(
      params.tokenId,
      auth.userId,
      params.organizationId,
    );

    response.status(200).json(successResponse({ token }, String(response.locals.requestId)));
  };
}
