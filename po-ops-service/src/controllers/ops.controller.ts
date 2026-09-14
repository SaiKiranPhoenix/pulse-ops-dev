import type { Request, Response } from "express";
import { successResponse } from "@pulseops/shared";
import type { OpsService } from "../services/ops.service.js";

export class OpsController {
  constructor(private readonly ops: OpsService) {}

  workers = async (_request: Request, response: Response): Promise<void> => {
    const workers = await this.ops.workers();
    response.status(200).json(successResponse({ workers }, String(response.locals.requestId)));
  };

  queues = async (_request: Request, response: Response): Promise<void> => {
    const queues = await this.ops.queues();
    response.status(200).json(successResponse({ queues }, String(response.locals.requestId)));
  };

  summary = async (_request: Request, response: Response): Promise<void> => {
    const summary = await this.ops.summary();
    response.status(200).json(successResponse({ summary }, String(response.locals.requestId)));
  };

  deadLetters = async (request: Request, response: Response): Promise<void> => {
    const limit = Number(request.query.limit ?? 20);
    const messages = await this.ops.deadLetters(Number.isFinite(limit) ? limit : 20);
    response.status(200).json(successResponse({ messages }, String(response.locals.requestId)));
  };

  replayDeadLetters = async (request: Request, response: Response): Promise<void> => {
    const limit = Number((request.body as { readonly limit?: unknown } | undefined)?.limit ?? 10);
    const replay = await this.ops.replayDeadLetters(Number.isFinite(limit) ? limit : 10);
    response.status(200).json(successResponse({ replay }, String(response.locals.requestId)));
  };
}
