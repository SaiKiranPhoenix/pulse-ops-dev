import { apiClient } from "@/lib/api-client";

export type UpstreamHealth = {
  readonly name: string;
  readonly url: string;
  readonly status: "ok" | "unavailable";
  readonly statusCode: number | null;
  readonly latencyMs: number;
};

export type GatewayHealth = {
  readonly status: "ok" | "degraded";
  readonly services: UpstreamHealth[];
};

export type OpenApiMethod = {
  readonly summary?: string;
};

export type OpenApiDocument = {
  readonly openapi: string;
  readonly info: {
    readonly title: string;
    readonly version: string;
  };
  readonly paths: Record<string, Record<string, OpenApiMethod>>;
};

export async function getGatewayHealth(): Promise<GatewayHealth> {
  const response = await apiClient.get<GatewayHealth>("/health/services", {
    validateStatus: (status) => status < 600,
  });
  return response.data;
}

export async function getOpenApiDocument(): Promise<OpenApiDocument> {
  const response = await apiClient.get<OpenApiDocument>("/openapi.json");
  return response.data;
}
