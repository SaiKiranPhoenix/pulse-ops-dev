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
}
