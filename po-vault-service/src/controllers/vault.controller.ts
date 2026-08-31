import type { Request, Response } from "express";
import { successResponse } from "@pulseops/shared";
import { getAuthContext } from "../middlewares/auth.middleware.js";
import type { VaultService } from "../services/vault.service.js";
import type {
  AppRoleLoginBody,
  CreateVaultAuthMethodBody,
  CreateSecretBody,
  CreateVaultTokenBody,
  RevealSecretBody,
  SecretParams,
  SecretQuery,
  UpdateSecretBody,
  VaultAuthMethodParams,
  VaultTokenParams,
} from "../validators/vault.validator.js";

export class VaultController {
  constructor(private readonly vault: VaultService) {}

  create = async (request: Request, response: Response): Promise<void> => {
    const body = response.locals.validatedBody as CreateSecretBody;
    const secret = await this.vault.create({
      ...body,
      ...auditContext(request, response),
    });

    response.status(201).json(successResponse({ secret }, String(response.locals.requestId)));
  };

  list = async (_request: Request, response: Response): Promise<void> => {
    const query = response.locals.validatedQuery as SecretQuery;
    const secrets = await this.vault.list(query.projectId, query.environment);

    response.status(200).json(successResponse({ secrets }, String(response.locals.requestId)));
  };

  reveal = async (request: Request, response: Response): Promise<void> => {
    const body = response.locals.validatedBody as RevealSecretBody;
    const params = response.locals.validatedParams as SecretParams;
    const secret = await this.vault.reveal({
      projectId: body.projectId,
      environment: params.environment,
      key: params.key,
      vaultPassword: body.vaultPassword,
      ...auditContext(request, response),
    });

    setNoStore(response);
    response.status(200).json(successResponse({ secret }, String(response.locals.requestId)));
  };

  update = async (request: Request, response: Response): Promise<void> => {
    const body = response.locals.validatedBody as UpdateSecretBody;
    const params = response.locals.validatedParams as SecretParams;
    const secret = await this.vault.update({
      projectId: body.projectId,
      environment: params.environment,
      key: params.key,
      value: body.value,
      ...auditContext(request, response),
    });

    response.status(200).json(successResponse({ secret }, String(response.locals.requestId)));
  };

  versions = async (_request: Request, response: Response): Promise<void> => {
    const query = response.locals.validatedQuery as SecretQuery;
    const params = response.locals.validatedParams as SecretParams;
    const versions = await this.vault.versions(query.projectId, params.environment, params.key);

    response.status(200).json(successResponse({ versions }, String(response.locals.requestId)));
  };

  delete = async (request: Request, response: Response): Promise<void> => {
    const query = response.locals.validatedQuery as SecretQuery;
    const params = response.locals.validatedParams as SecretParams;
    const secret = await this.vault.delete(
      query.projectId,
      params.environment,
      params.key,
      auditContext(request, response),
    );

    response.status(200).json(successResponse({ secret }, String(response.locals.requestId)));
  };

  createToken = async (request: Request, response: Response): Promise<void> => {
    const body = response.locals.validatedBody as CreateVaultTokenBody;
    const token = await this.vault.createToken({
      ...body,
      expiresAt:
        body.expiresAt === undefined || body.expiresAt === null ? null : new Date(body.expiresAt),
      ttlSeconds: body.ttlSeconds,
      maxTtlSeconds: body.maxTtlSeconds,
      renewable: body.renewable,
      ...auditContext(request, response),
    });

    response.status(201).json(successResponse(token, String(response.locals.requestId)));
  };

  listTokens = async (_request: Request, response: Response): Promise<void> => {
    const query = response.locals.validatedQuery as SecretQuery;
    const tokens = await this.vault.listTokens(query.projectId);

    response.status(200).json(successResponse({ tokens }, String(response.locals.requestId)));
  };

  tokenCacheDiagnostics = async (_request: Request, response: Response): Promise<void> => {
    const query = response.locals.validatedQuery as SecretQuery;
    const diagnostics = this.vault.tokenCacheDiagnostics(query.projectId);

    response.status(200).json(successResponse({ diagnostics }, String(response.locals.requestId)));
  };

  revokeToken = async (request: Request, response: Response): Promise<void> => {
    const query = response.locals.validatedQuery as SecretQuery;
    const params = response.locals.validatedParams as VaultTokenParams;
    const token = await this.vault.revokeToken(
      query.projectId,
      params.tokenId,
      auditContext(request, response),
    );

    response.status(200).json(successResponse({ token }, String(response.locals.requestId)));
  };

  lookupToken = async (request: Request, response: Response): Promise<void> => {
    const token = await this.vault.lookupToken(extractVaultToken(request));

    response.status(200).json(successResponse({ token }, String(response.locals.requestId)));
  };

  renewToken = async (request: Request, response: Response): Promise<void> => {
    const token = await this.vault.renewToken(extractVaultToken(request));

    response.status(200).json(successResponse({ token }, String(response.locals.requestId)));
  };

  revokeSelf = async (request: Request, response: Response): Promise<void> => {
    const token = await this.vault.revokeSelf(extractVaultToken(request));

    response.status(200).json(successResponse({ token }, String(response.locals.requestId)));
  };

  createAuthMethod = async (request: Request, response: Response): Promise<void> => {
    const body = response.locals.validatedBody as CreateVaultAuthMethodBody;
    const authMethod = await this.vault.createAuthMethod({
      ...body,
      ...auditContext(request, response),
    });

    response.status(201).json(successResponse(authMethod, String(response.locals.requestId)));
  };

  listAuthMethods = async (_request: Request, response: Response): Promise<void> => {
    const query = response.locals.validatedQuery as SecretQuery;
    const authMethods = await this.vault.listAuthMethods(query.projectId);

    response.status(200).json(successResponse({ authMethods }, String(response.locals.requestId)));
  };

  disableAuthMethod = async (_request: Request, response: Response): Promise<void> => {
    const query = response.locals.validatedQuery as SecretQuery;
    const params = response.locals.validatedParams as VaultAuthMethodParams;
    const authMethod = await this.vault.disableAuthMethod(query.projectId, params.authMethodId);

    response.status(200).json(successResponse({ authMethod }, String(response.locals.requestId)));
  };

  listIdentities = async (_request: Request, response: Response): Promise<void> => {
    const query = response.locals.validatedQuery as SecretQuery;
    const identities = await this.vault.listIdentities(query.projectId);

    response.status(200).json(successResponse({ identities }, String(response.locals.requestId)));
  };

  loginAppRole = async (_request: Request, response: Response): Promise<void> => {
    const body = response.locals.validatedBody as AppRoleLoginBody;
    const token = await this.vault.loginAppRole({
      projectId: body.projectId,
      roleId: body.roleId,
      secretId: body.secretId,
      correlationId: String(response.locals.requestId ?? "unknown"),
    });

    response.status(200).json(successResponse(token, String(response.locals.requestId)));
  };

  fetchWithToken = async (request: Request, response: Response): Promise<void> => {
    const params = response.locals.validatedParams as SecretParams;
    const secret = await this.vault.fetchWithToken({
      rawToken: extractVaultToken(request),
      environment: params.environment,
      key: params.key,
      correlationId: String(response.locals.requestId ?? "unknown"),
    });

    setNoStore(response);
    response.status(200).json(successResponse({ secret }, String(response.locals.requestId)));
  };
}

function setNoStore(response: Response): void {
  response.setHeader("Cache-Control", "no-store");
  response.setHeader("Pragma", "no-cache");
}

function auditContext(
  request: Request,
  response: Response,
): { readonly actorId: string; readonly correlationId: string } {
  const auth = getAuthContext(response);

  return {
    actorId: auth.userId,
    correlationId: String(response.locals.requestId ?? "unknown"),
  };
}

function extractVaultToken(request: Request): string {
  const headerToken = request.header("x-vault-token");

  if (headerToken !== undefined && headerToken.length > 0) {
    return headerToken;
  }

  const authorization = request.header("authorization");
  const [scheme, token] = authorization?.split(" ") ?? [];

  if (scheme === "Bearer" && token !== undefined && token.length > 0) {
    return token;
  }

  return "";
}
