import { apiClient } from "@/lib/api-client";
import type { ApiSuccessResponse } from "@/types/api";

export type ServiceLanguage =
  "nodejs" | "python" | "go" | "java" | "rust" | "csharp" | "ruby" | "other";

export type ServiceRuntime =
  "docker" | "kubernetes" | "lambda" | "baremetal" | "cloud_run" | "ecs" | "other";

export type ServiceTier = "tier_1" | "tier_2" | "tier_3";

export type ServiceStatus = "active" | "discovered" | "archived";

export type ServiceChecklistItem = {
  readonly id: string;
  readonly title: string;
  readonly completed: boolean;
  readonly completedAt: string | null;
};

export type ServiceHealthStatus = "healthy" | "degraded" | "critical";

export type ServiceHealthScore = {
  readonly score: number;
  readonly status: ServiceHealthStatus;
  readonly errorPenalty: number;
  readonly incidentPenalty: number;
  readonly latencyPenalty: number;
  readonly readinessScore: number;
};

export type ServiceCatalogItem = {
  readonly id: string;
  readonly projectId: string;
  readonly name: string;
  readonly displayName: string | null;
  readonly description: string | null;
  readonly ownerName: string | null;
  readonly ownerEmail: string | null;
  readonly ownerTeam: string | null;
  readonly language: ServiceLanguage;
  readonly runtime: ServiceRuntime;
  readonly tier: ServiceTier;
  readonly repoUrl: string | null;
  readonly runbookUrl: string | null;
  readonly deploymentUrl: string | null;
  readonly tags: string[];
  readonly onboardingChecklist: ServiceChecklistItem[];
  readonly isAutoDiscovered: boolean;
  readonly status: ServiceStatus;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly health: ServiceHealthScore;
  readonly stats: {
    readonly totalEvents24h: number;
    readonly errorCount24h: number;
    readonly errorRate24h: number;
    readonly p95LatencyMs: number | null;
    readonly avgLatencyMs: number | null;
    readonly openIncidentsCount: number;
  };
};

export type ServiceDependencyEdge = {
  readonly service: string;
  readonly callCount: number;
  readonly errorCount: number;
  readonly avgLatencyMs: number;
};

export type ServiceDetail = ServiceCatalogItem & {
  readonly dependencies: {
    readonly inbound: ServiceDependencyEdge[];
    readonly outbound: ServiceDependencyEdge[];
  };
  readonly recentErrors: Array<{
    readonly id: string;
    readonly fingerprint: string;
    readonly message: string | null;
    readonly level: string | null;
    readonly observedAt: string;
    readonly count: number;
  }>;
  readonly recentIncidents: Array<{
    readonly id: string;
    readonly title: string;
    readonly severity: string;
    readonly status: string;
    readonly eventCount: number;
    readonly createdAt: string;
  }>;
  readonly relatedSecretsCount: number;
};

export type UpsertServiceInput = {
  readonly name: string;
  readonly displayName?: string | null;
  readonly description?: string | null;
  readonly ownerName?: string | null;
  readonly ownerEmail?: string | null;
  readonly ownerTeam?: string | null;
  readonly language?: ServiceLanguage;
  readonly runtime?: ServiceRuntime;
  readonly tier?: ServiceTier;
  readonly repoUrl?: string | null;
  readonly runbookUrl?: string | null;
  readonly deploymentUrl?: string | null;
  readonly tags?: string[];
  readonly onboardingChecklist?: ServiceChecklistItem[];
  readonly status?: ServiceStatus;
};

export async function listServices(projectId: string): Promise<ServiceCatalogItem[]> {
  const response = await apiClient.get<ApiSuccessResponse<{ services: ServiceCatalogItem[] }>>(
    `/dashboard/services?projectId=${encodeURIComponent(projectId)}`,
  );
  return response.data.data.services;
}

export async function getServiceDetail(
  projectId: string,
  serviceName: string,
): Promise<ServiceDetail> {
  const response = await apiClient.get<ApiSuccessResponse<{ service: ServiceDetail }>>(
    `/dashboard/services/${encodeURIComponent(serviceName)}?projectId=${encodeURIComponent(projectId)}`,
  );
  return response.data.data.service;
}

export async function upsertService(
  projectId: string,
  input: UpsertServiceInput,
): Promise<ServiceCatalogItem> {
  const response = await apiClient.post<ApiSuccessResponse<{ service: ServiceCatalogItem }>>(
    `/dashboard/services?projectId=${encodeURIComponent(projectId)}`,
    input,
  );
  return response.data.data.service;
}

export async function deleteService(projectId: string, serviceName: string): Promise<boolean> {
  const response = await apiClient.delete<ApiSuccessResponse<{ deleted: boolean }>>(
    `/dashboard/services/${encodeURIComponent(serviceName)}?projectId=${encodeURIComponent(projectId)}`,
  );
  return response.data.data.deleted;
}
