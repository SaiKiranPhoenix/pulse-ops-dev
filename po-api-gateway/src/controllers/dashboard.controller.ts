import type { Request, Response } from "express";
import { successResponse } from "@pulseops/shared";
import type { DashboardService } from "../services/dashboard.service.js";
import type { ProjectQuery } from "../validators/dashboard.validator.js";

export class DashboardController {
  constructor(private readonly dashboard: DashboardService) {}

  summary = async (_request: Request, response: Response): Promise<void> => {
    const query = response.locals.validatedQuery as ProjectQuery;
    const summary = await this.dashboard.summary(query.projectId);

    response.status(200).json(successResponse({ summary }, String(response.locals.requestId)));
  };

  events = async (_request: Request, response: Response): Promise<void> => {
    const query = response.locals.validatedQuery as ProjectQuery;
    const events = await this.dashboard.events(query.projectId);

    response.status(200).json(successResponse({ events }, String(response.locals.requestId)));
  };

  incidents = async (_request: Request, response: Response): Promise<void> => {
    const query = response.locals.validatedQuery as ProjectQuery;
    const incidents = await this.dashboard.incidents(query.projectId);

    response.status(200).json(successResponse({ incidents }, String(response.locals.requestId)));
  };

  vaultActivity = async (_request: Request, response: Response): Promise<void> => {
    const query = response.locals.validatedQuery as ProjectQuery;
    const vaultActivity = await this.dashboard.vaultActivity(query.projectId);

    response
      .status(200)
      .json(successResponse({ vaultActivity }, String(response.locals.requestId)));
  };
}
