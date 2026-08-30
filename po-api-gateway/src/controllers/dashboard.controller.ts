import type { Request, Response } from "express";
import { successResponse } from "@pulseops/shared";
import { getAuthContext } from "../middlewares/auth.middleware.js";
import type { DashboardService } from "../services/dashboard.service.js";
import type {
  DashboardAnalyticsQuery,
  DashboardEventsQuery,
  ProjectQuery,
} from "../validators/dashboard.validator.js";

export class DashboardController {
  constructor(private readonly dashboard: DashboardService) {}

  summary = async (_request: Request, response: Response): Promise<void> => {
    const query = response.locals.validatedQuery as ProjectQuery;
    const auth = getAuthContext(response);
    const summary = await this.dashboard.summary(auth.userId, query.projectId);

    response.status(200).json(successResponse({ summary }, String(response.locals.requestId)));
  };

  events = async (_request: Request, response: Response): Promise<void> => {
    const query = response.locals.validatedQuery as DashboardEventsQuery;
    const auth = getAuthContext(response);
    const events = await this.dashboard.events(auth.userId, query.projectId, {
      ...(query.cursor === undefined ? {} : { cursor: query.cursor }),
      limit: query.limit,
    });

    response.status(200).json(successResponse(events, String(response.locals.requestId)));
  };

  incidents = async (_request: Request, response: Response): Promise<void> => {
    const query = response.locals.validatedQuery as ProjectQuery;
    const auth = getAuthContext(response);
    const incidents = await this.dashboard.incidents(auth.userId, query.projectId);

    response.status(200).json(successResponse({ incidents }, String(response.locals.requestId)));
  };

  vaultActivity = async (_request: Request, response: Response): Promise<void> => {
    const query = response.locals.validatedQuery as ProjectQuery;
    const auth = getAuthContext(response);
    const vaultActivity = await this.dashboard.vaultActivity(auth.userId, query.projectId);

    response
      .status(200)
      .json(successResponse({ vaultActivity }, String(response.locals.requestId)));
  };

  ingestionStats = async (_request: Request, response: Response): Promise<void> => {
    const query = response.locals.validatedQuery as DashboardAnalyticsQuery;
    const auth = getAuthContext(response);
    const ingestion = await this.dashboard.ingestionStats(
      auth.userId,
      query.projectId,
      toAnalyticsOptions(query),
    );

    response.status(200).json(successResponse({ ingestion }, String(response.locals.requestId)));
  };

  errorGroups = async (_request: Request, response: Response): Promise<void> => {
    const query = response.locals.validatedQuery as DashboardAnalyticsQuery;
    const auth = getAuthContext(response);
    const errorGroups = await this.dashboard.errorGroups(
      auth.userId,
      query.projectId,
      toAnalyticsOptions(query),
    );

    response.status(200).json(successResponse({ errorGroups }, String(response.locals.requestId)));
  };

  metricSummary = async (_request: Request, response: Response): Promise<void> => {
    const query = response.locals.validatedQuery as DashboardAnalyticsQuery;
    const auth = getAuthContext(response);
    const metrics = await this.dashboard.metricSummary(
      auth.userId,
      query.projectId,
      toAnalyticsOptions(query),
    );

    response.status(200).json(successResponse({ metrics }, String(response.locals.requestId)));
  };

  traceSummary = async (_request: Request, response: Response): Promise<void> => {
    const query = response.locals.validatedQuery as DashboardAnalyticsQuery;
    const auth = getAuthContext(response);
    const traces = await this.dashboard.traceSummary(
      auth.userId,
      query.projectId,
      toAnalyticsOptions(query),
    );

    response.status(200).json(successResponse({ traces }, String(response.locals.requestId)));
  };
}

function toAnalyticsOptions(query: DashboardAnalyticsQuery) {
  return {
    ...(query.environment === undefined ? {} : { environment: query.environment }),
    timeRange: query.timeRange,
  };
}
