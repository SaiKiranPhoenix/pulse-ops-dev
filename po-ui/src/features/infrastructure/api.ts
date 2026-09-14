import { apiClient } from "@/lib/api-client";

export type HostStatus = "healthy" | "degraded" | "offline";

export interface HostNode {
  id: string;
  projectId: string;
  hostname: string;
  ipAddress: string;
  os: string;
  arch: string;
  cpuCores: number;
  memoryTotalMb: number;
  diskTotalGb: number;
  status: HostStatus;
  tags: Record<string, string>;
  cpuPercent: number;
  memoryPercent: number;
  diskPercent: number;
  networkRxKbps: number;
  networkTxKbps: number;
  uptimeSeconds: number;
  lastHeartbeat: string;
}

export type ContainerStatus = "running" | "restarting" | "stopped" | "unhealthy";

export interface ContainerNode {
  id: string;
  projectId: string;
  containerId: string;
  name: string;
  image: string;
  serviceName: string;
  hostId: string;
  status: ContainerStatus;
  cpuPercent: number;
  memoryUsageMb: number;
  memoryLimitMb: number;
  networkRxKbps: number;
  networkTxKbps: number;
  restartCount: number;
  uptimeSeconds: number;
  ports: string[];
  createdAt: string;
  updatedAt: string;
}

export type DependencyStatus = "healthy" | "degraded" | "unreachable";

export interface DependencyHealth {
  name: "RabbitMQ" | "MongoDB" | "Redis" | "Vault";
  status: DependencyStatus;
  latencyMs: number;
  connectionCount?: number;
  details: Record<string, unknown>;
}

export interface InfrastructureOverview {
  totalHosts: number;
  healthyHosts: number;
  totalContainers: number;
  runningContainers: number;
  avgCpuPercent: number;
  avgMemoryPercent: number;
  dependencies: DependencyHealth[];
}

interface ApiResponse<T> {
  status: string;
  data: T;
}

export async function getInfrastructureOverview(
  projectId: string,
): Promise<InfrastructureOverview> {
  const res = await apiClient.get<ApiResponse<{ overview: InfrastructureOverview }>>(
    `/infra/overview?projectId=${encodeURIComponent(projectId)}`,
  );
  return res.data.data.overview;
}

export async function listHostNodes(projectId: string): Promise<HostNode[]> {
  const res = await apiClient.get<ApiResponse<{ hosts: HostNode[] }>>(
    `/infra/hosts?projectId=${encodeURIComponent(projectId)}`,
  );
  return res.data.data.hosts;
}

export async function listContainers(projectId: string): Promise<ContainerNode[]> {
  const res = await apiClient.get<ApiResponse<{ containers: ContainerNode[] }>>(
    `/infra/containers?projectId=${encodeURIComponent(projectId)}`,
  );
  return res.data.data.containers;
}

export async function getDependencyHealth(projectId: string): Promise<DependencyHealth[]> {
  const res = await apiClient.get<ApiResponse<{ dependencies: DependencyHealth[] }>>(
    `/infra/dependencies?projectId=${encodeURIComponent(projectId)}`,
  );
  return res.data.data.dependencies;
}
