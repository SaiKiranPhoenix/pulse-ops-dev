import type { Request, Response } from "express";
import { successResponse } from "@pulseops/shared";
import type { IncidentService } from "../services/incident.service.js";
import type {
  IncidentListQuery,
  IncidentParams,
  ResolveIncidentBody,
} from "../validators/incident.validator.js";

export class IncidentController {
  constructor(private readonly incidents: IncidentService) {}

  list = async (_request: Request, response: Response): Promise<void> => {
    const query = response.locals.validatedQuery as IncidentListQuery;
    const incidents = await this.incidents.list({
      projectId: query.projectId,
      status: query.status,
    });

    response.status(200).json(successResponse({ incidents }, String(response.locals.requestId)));
  };

  detail = async (_request: Request, response: Response): Promise<void> => {
    const query = response.locals.validatedQuery as IncidentListQuery;
    const params = response.locals.validatedParams as IncidentParams;
    const incident = await this.incidents.detail(query.projectId, params.incidentId);

    response.status(200).json(successResponse({ incident }, String(response.locals.requestId)));
  };

  resolve = async (_request: Request, response: Response): Promise<void> => {
    const query = response.locals.validatedQuery as IncidentListQuery;
    const params = response.locals.validatedParams as IncidentParams;
    const body = response.locals.validatedBody as ResolveIncidentBody;
    const incident = await this.incidents.resolve(
      query.projectId,
      params.incidentId,
      body.resolutionNote ?? null,
    );

    response.status(200).json(successResponse({ incident }, String(response.locals.requestId)));
  };

  acknowledge = async (_request: Request, response: Response): Promise<void> => {
    const query = response.locals.validatedQuery as IncidentListQuery;
    const params = response.locals.validatedParams as IncidentParams;
    const incident = await this.incidents.acknowledge(query.projectId, params.incidentId);

    response.status(200).json(successResponse({ incident }, String(response.locals.requestId)));
  };

  reopen = async (_request: Request, response: Response): Promise<void> => {
    const query = response.locals.validatedQuery as IncidentListQuery;
    const params = response.locals.validatedParams as IncidentParams;
    const incident = await this.incidents.reopen(query.projectId, params.incidentId);

    response.status(200).json(successResponse({ incident }, String(response.locals.requestId)));
  };

  triage = async (request: Request, response: Response): Promise<void> => {
    const query = response.locals.validatedQuery as IncidentListQuery;
    const params = response.locals.validatedParams as IncidentParams;
    const incident = await this.incidents.triage(
      query.projectId,
      params.incidentId,
      request.body,
    );

    response.status(200).json(successResponse({ incident }, String(response.locals.requestId)));
  };

  addComment = async (request: Request, response: Response): Promise<void> => {
    const query = response.locals.validatedQuery as IncidentListQuery;
    const params = response.locals.validatedParams as IncidentParams;
    const incident = await this.incidents.addComment(
      query.projectId,
      params.incidentId,
      request.body,
    );

    response.status(201).json(successResponse({ incident }, String(response.locals.requestId)));
  };

  savePostmortem = async (request: Request, response: Response): Promise<void> => {
    const query = response.locals.validatedQuery as IncidentListQuery;
    const params = response.locals.validatedParams as IncidentParams;
    const incident = await this.incidents.savePostmortem(
      query.projectId,
      params.incidentId,
      request.body,
    );

    response.status(200).json(successResponse({ incident }, String(response.locals.requestId)));
  };

  exportSummary = async (_request: Request, response: Response): Promise<void> => {
    const query = response.locals.validatedQuery as IncidentListQuery;
    const params = response.locals.validatedParams as IncidentParams;
    const summary = await this.incidents.exportSummary(query.projectId, params.incidentId);

    response.status(200).json(successResponse(summary, String(response.locals.requestId)));
  };
}
