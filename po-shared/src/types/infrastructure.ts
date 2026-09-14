export type HostStatus = "healthy" | "degraded" | "offline";

export interface HostNode {
  readonly id: string;
  readonly projectId: string;
  readonly hostname: string;
  readonly ipAddress: string;
  readonly os: string;
  readonly arch: string;
  readonly cpuCores: number;
  readonly memoryTotalMb: number;
  readonly diskTotalGb: number;
  readonly status: HostStatus;
  readonly tags: Record<string, string>;
  readonly cpuPercent: number;
  readonly memoryPercent: number;
  readonly diskPercent: number;
  readonly networkRxKbps: number;
  readonly networkTxKbps: number;
  readonly uptimeSeconds: number;
  readonly lastHeartbeat: string;
}

export type ContainerStatus = "running" | "restarting" | "stopped" | "unhealthy";

export interface ContainerNode {
  readonly id: string;
  readonly projectId: string;
  readonly containerId: string;
  readonly name: string;
  readonly image: string;
  readonly serviceName: string;
  readonly hostId: string;
  readonly status: ContainerStatus;
  readonly cpuPercent: number;
  readonly memoryUsageMb: number;
  readonly memoryLimitMb: number;
  readonly networkRxKbps: number;
  readonly networkTxKbps: number;
  readonly restartCount: number;
  readonly uptimeSeconds: number;
  readonly ports: string[];
  readonly createdAt: string;
  readonly updatedAt: string;
}

export type DependencyStatus = "healthy" | "degraded" | "unreachable";

export interface DependencyHealth {
  readonly name: "RabbitMQ" | "MongoDB" | "Redis" | "Vault";
  readonly status: DependencyStatus;
  readonly latencyMs: number;
  readonly connectionCount?: number | undefined;
  readonly details: Record<string, unknown>;
}

export interface InfrastructureOverview {
  readonly totalHosts: number;
  readonly healthyHosts: number;
  readonly totalContainers: number;
  readonly runningContainers: number;
  readonly avgCpuPercent: number;
  readonly avgMemoryPercent: number;
  readonly dependencies: DependencyHealth[];
}
