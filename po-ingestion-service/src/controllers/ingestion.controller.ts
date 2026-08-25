import type { Request, Response } from "express";
import { successResponse, unauthorized } from "@pulseops/shared";
import type { IngestionService } from "../services/ingestion.service.js";
import type { ErrorBody, LogBody, MetricBody } from "../validators/ingestion.validator.js";

export class IngestionController {
  constructor(private readonly ingestion: IngestionService) {}

  ingestLog = async (request: Request, response: Response): Promise<void> => {
    const body = response.locals.validatedBody as LogBody;
    const event = await this.ingestion.ingest({
      rawApiKey: getApiKey(request),
      idempotencyKey: getIdempotencyKey(request),
      type: "log",
      source: body.source,
      level: body.level,
      message: body.message,
      fingerprint: body.fingerprint,
      attributes: body.attributes,
      timestamp: body.timestamp,
    });

    response.status(202).json(successResponse({ event }, String(response.locals.requestId)));
  };

  ingestError = async (request: Request, response: Response): Promise<void> => {
    const body = response.locals.validatedBody as ErrorBody;
    const event = await this.ingestion.ingest({
      rawApiKey: getApiKey(request),
      idempotencyKey: getIdempotencyKey(request),
      type: "error",
      source: body.source,
      name: body.name,
      message: body.message,
      fingerprint: body.fingerprint,
      attributes: {
        ...(body.attributes ?? {}),
        ...(body.stack === undefined ? {} : { stack: body.stack }),
        hasStack: body.stack !== undefined,
      },
      timestamp: body.timestamp,
    });

    response.status(202).json(successResponse({ event }, String(response.locals.requestId)));
  };

  ingestMetric = async (request: Request, response: Response): Promise<void> => {
    const body = response.locals.validatedBody as MetricBody;
    const event = await this.ingestion.ingest({
      rawApiKey: getApiKey(request),
      idempotencyKey: getIdempotencyKey(request),
      type: "metric",
      source: body.source,
      name: body.name,
      value: body.value,
      unit: body.unit,
      fingerprint: body.fingerprint,
      attributes: body.attributes,
      timestamp: body.timestamp,
    });

    response.status(202).json(successResponse({ event }, String(response.locals.requestId)));
  };
}

function getApiKey(request: Request): string {
  const apiKey = request.header("x-api-key");

  if (apiKey === undefined || apiKey.length === 0) {
    throw unauthorized("API key is required");
  }

  return apiKey;
}

function getIdempotencyKey(request: Request): string | null {
  const idempotencyKey = request.header("idempotency-key")?.trim();
  return idempotencyKey === undefined || idempotencyKey.length === 0 ? null : idempotencyKey;
}
