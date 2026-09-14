import type { Request, Response } from "express";
import { successResponse } from "@pulseops/shared";
import { getAuthContext } from "../middlewares/auth.middleware.js";
import type { ServiceCatalogService } from "../services/service-catalog.service.js";
import type {
  ServiceParams,
  ServiceQuery,
  UpsertServiceBody,
} from "../validators/service.validator.js";

export class ServiceController {
  constructor(private readonly services: ServiceCatalogService) {}

  list = async (_request: Request, response: Response): Promise<void> => {
    const query = response.locals.validatedQuery as ServiceQuery;
    const auth = getAuthContext(response);
    const services = await this.services.listServices(auth.userId, query.projectId);

    response.status(200).json(successResponse({ services }, String(response.locals.requestId)));
  };

  detail = async (_request: Request, response: Response): Promise<void> => {
    const query = response.locals.validatedQuery as ServiceQuery;
    const params = response.locals.validatedParams as ServiceParams;
    const auth = getAuthContext(response);
    const service = await this.services.getServiceDetail(
      auth.userId,
      query.projectId,
      params.serviceName,
    );

    response.status(200).json(successResponse({ service }, String(response.locals.requestId)));
  };

  upsert = async (_request: Request, response: Response): Promise<void> => {
    const query = response.locals.validatedQuery as ServiceQuery;
    const body = response.locals.validatedBody as UpsertServiceBody;
    const auth = getAuthContext(response);

    const service = await this.services.upsertService(auth.userId, query.projectId, {
      projectId: query.projectId,
      ...body,
    });

    response.status(200).json(successResponse({ service }, String(response.locals.requestId)));
  };

  delete = async (_request: Request, response: Response): Promise<void> => {
    const query = response.locals.validatedQuery as ServiceQuery;
    const params = response.locals.validatedParams as ServiceParams;
    const auth = getAuthContext(response);

    const deleted = await this.services.deleteService(
      auth.userId,
      query.projectId,
      params.serviceName,
    );

    response.status(200).json(successResponse({ deleted }, String(response.locals.requestId)));
  };
}
