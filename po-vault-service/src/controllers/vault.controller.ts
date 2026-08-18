import type { Request, Response } from "express";
import { successResponse } from "@pulseops/shared";
import type { VaultService } from "../services/vault.service.js";
import type {
  CreateSecretBody,
  SecretParams,
  SecretQuery,
  UpdateSecretBody,
} from "../validators/vault.validator.js";

export class VaultController {
  constructor(private readonly vault: VaultService) {}

  create = async (_request: Request, response: Response): Promise<void> => {
    const body = response.locals.validatedBody as CreateSecretBody;
    const secret = await this.vault.create(body);

    response.status(201).json(successResponse({ secret }, String(response.locals.requestId)));
  };

  list = async (_request: Request, response: Response): Promise<void> => {
    const query = response.locals.validatedQuery as SecretQuery;
    const secrets = await this.vault.list(query.projectId, query.environment);

    response.status(200).json(successResponse({ secrets }, String(response.locals.requestId)));
  };

  reveal = async (_request: Request, response: Response): Promise<void> => {
    const query = response.locals.validatedQuery as SecretQuery;
    const params = response.locals.validatedParams as SecretParams;
    const secret = await this.vault.reveal(query.projectId, params.environment, params.key);

    response.status(200).json(successResponse({ secret }, String(response.locals.requestId)));
  };

  update = async (_request: Request, response: Response): Promise<void> => {
    const body = response.locals.validatedBody as UpdateSecretBody;
    const params = response.locals.validatedParams as SecretParams;
    const secret = await this.vault.update({
      projectId: body.projectId,
      environment: params.environment,
      key: params.key,
      value: body.value,
    });

    response.status(200).json(successResponse({ secret }, String(response.locals.requestId)));
  };

  delete = async (_request: Request, response: Response): Promise<void> => {
    const query = response.locals.validatedQuery as SecretQuery;
    const params = response.locals.validatedParams as SecretParams;
    const secret = await this.vault.delete(query.projectId, params.environment, params.key);

    response.status(200).json(successResponse({ secret }, String(response.locals.requestId)));
  };
}
