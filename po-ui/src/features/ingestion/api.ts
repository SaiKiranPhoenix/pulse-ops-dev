import { apiClient } from "@/lib/api-client";
import type { ApiSuccessResponse } from "@/types/api";

export type IngestedEventAck = {
  readonly id: string;
  readonly projectId: string;
  readonly type: "log" | "error" | "metric";
  readonly source: string;
  readonly fingerprint: string;
  readonly observedAt: string;
  readonly receivedAt: string;
  readonly idempotentReplay: boolean;
};

export type IngestionHeaders = {
  readonly apiKey: string;
  readonly idempotencyKey?: string;
};

export async function ingestLog(
  headers: IngestionHeaders,
  input: {
    readonly source: string;
    readonly level?: "debug" | "info" | "warn" | "error";
    readonly message: string;
    readonly fingerprint?: string;
    readonly attributes?: Record<string, unknown>;
    readonly timestamp?: string;
  },
): Promise<IngestedEventAck> {
  const response = await apiClient.post<ApiSuccessResponse<{ readonly event: IngestedEventAck }>>(
    "/ingest/logs",
    input,
    { headers: createIngestionHeaders(headers) },
  );
  return response.data.data.event;
}

export async function ingestError(
  headers: IngestionHeaders,
  input: {
    readonly source: string;
    readonly name?: string;
    readonly message: string;
    readonly stack?: string;
    readonly fingerprint?: string;
    readonly attributes?: Record<string, unknown>;
    readonly timestamp?: string;
  },
): Promise<IngestedEventAck> {
  const response = await apiClient.post<ApiSuccessResponse<{ readonly event: IngestedEventAck }>>(
    "/ingest/errors",
    input,
    { headers: createIngestionHeaders(headers) },
  );
  return response.data.data.event;
}

export async function ingestMetric(
  headers: IngestionHeaders,
  input: {
    readonly source: string;
    readonly name: string;
    readonly value: number;
    readonly unit?: string;
    readonly fingerprint?: string;
    readonly attributes?: Record<string, unknown>;
    readonly timestamp?: string;
  },
): Promise<IngestedEventAck> {
  const response = await apiClient.post<ApiSuccessResponse<{ readonly event: IngestedEventAck }>>(
    "/ingest/metrics",
    input,
    { headers: createIngestionHeaders(headers) },
  );
  return response.data.data.event;
}

function createIngestionHeaders(headers: IngestionHeaders): Record<string, string> {
  return {
    "x-api-key": headers.apiKey,
    ...(headers.idempotencyKey === undefined ? {} : { "idempotency-key": headers.idempotencyKey }),
  };
}
