import type {
  ContainerNode,
  DependencyHealth,
  HostNode,
  InfrastructureOverview,
} from "@pulseops/shared";

export class InfrastructureRepository {
  private readonly hostsStore = new Map<string, HostNode>();
  private readonly containersStore = new Map<string, ContainerNode>();

  constructor() {
    this.seedDefaults();
  }

  private seedDefaults(): void {
    const now = new Date().toISOString();

    const defaultHosts: HostNode[] = [
      {
        id: "host_k8s_worker_01",
        projectId: "default",
        hostname: "node-prod-app-01",
        ipAddress: "10.0.1.12",
        os: "Ubuntu 22.04 LTS (Linux 5.15)",
        arch: "x86_64",
        cpuCores: 8,
        memoryTotalMb: 32768,
        diskTotalGb: 500,
        status: "healthy",
        tags: { role: "application", az: "us-east-1a", cluster: "prod-eks-01" },
        cpuPercent: 34.2,
        memoryPercent: 58.6,
        diskPercent: 42.1,
        networkRxKbps: 4520,
        networkTxKbps: 8940,
        uptimeSeconds: 1248920,
        lastHeartbeat: now,
      },
      {
        id: "host_k8s_worker_02",
        projectId: "default",
        hostname: "node-prod-app-02",
        ipAddress: "10.0.1.13",
        os: "Ubuntu 22.04 LTS (Linux 5.15)",
        arch: "x86_64",
        cpuCores: 8,
        memoryTotalMb: 32768,
        diskTotalGb: 500,
        status: "healthy",
        tags: { role: "application", az: "us-east-1b", cluster: "prod-eks-01" },
        cpuPercent: 48.5,
        memoryPercent: 64.1,
        diskPercent: 46.3,
        networkRxKbps: 6200,
        networkTxKbps: 11200,
        uptimeSeconds: 1248900,
        lastHeartbeat: now,
      },
      {
        id: "host_infra_db_01",
        projectId: "default",
        hostname: "node-prod-db-01",
        ipAddress: "10.0.2.20",
        os: "Debian 12 Bookworm",
        arch: "x86_64",
        cpuCores: 16,
        memoryTotalMb: 65536,
        diskTotalGb: 2000,
        status: "healthy",
        tags: { role: "datastore", az: "us-east-1a", cluster: "prod-db" },
        cpuPercent: 22.8,
        memoryPercent: 71.4,
        diskPercent: 61.2,
        networkRxKbps: 14500,
        networkTxKbps: 18900,
        uptimeSeconds: 3892000,
        lastHeartbeat: now,
      },
    ];

    for (const h of defaultHosts) {
      this.hostsStore.set(h.id, h);
    }

    const defaultContainers: ContainerNode[] = [
      {
        id: "cnt_gateway_1",
        projectId: "default",
        containerId: "d8f1e29a8c10",
        name: "pulseops-api-gateway",
        image: "pulseops/api-gateway:latest",
        serviceName: "po-api-gateway",
        hostId: "host_k8s_worker_01",
        status: "running",
        cpuPercent: 12.4,
        memoryUsageMb: 245,
        memoryLimitMb: 1024,
        networkRxKbps: 1200,
        networkTxKbps: 3400,
        restartCount: 0,
        uptimeSeconds: 84920,
        ports: ["4000:4000"],
        createdAt: now,
        updatedAt: now,
      },
      {
        id: "cnt_ingestion_1",
        projectId: "default",
        containerId: "b4c2d38e9a01",
        name: "pulseops-ingestion-svc",
        image: "pulseops/ingestion-service:latest",
        serviceName: "po-ingestion-service",
        hostId: "host_k8s_worker_01",
        status: "running",
        cpuPercent: 28.6,
        memoryUsageMb: 380,
        memoryLimitMb: 1024,
        networkRxKbps: 8900,
        networkTxKbps: 1400,
        restartCount: 0,
        uptimeSeconds: 84910,
        ports: ["4001:4001"],
        createdAt: now,
        updatedAt: now,
      },
      {
        id: "cnt_workers_1",
        projectId: "default",
        containerId: "e9f0a1b2c3d4",
        name: "pulseops-event-workers",
        image: "pulseops/event-workers:latest",
        serviceName: "po-event-workers",
        hostId: "host_k8s_worker_02",
        status: "running",
        cpuPercent: 36.2,
        memoryUsageMb: 512,
        memoryLimitMb: 2048,
        networkRxKbps: 4500,
        networkTxKbps: 2800,
        restartCount: 1,
        uptimeSeconds: 42300,
        ports: [],
        createdAt: now,
        updatedAt: now,
      },
      {
        id: "cnt_redis_1",
        projectId: "default",
        containerId: "a1b2c3d4e5f6",
        name: "pulseops-redis-cluster",
        image: "redis:7.2-alpine",
        serviceName: "redis",
        hostId: "host_infra_db_01",
        status: "running",
        cpuPercent: 8.5,
        memoryUsageMb: 680,
        memoryLimitMb: 4096,
        networkRxKbps: 9800,
        networkTxKbps: 9600,
        restartCount: 0,
        uptimeSeconds: 3891000,
        ports: ["6379:6379"],
        createdAt: now,
        updatedAt: now,
      },
      {
        id: "cnt_rabbitmq_1",
        projectId: "default",
        containerId: "f6e5d4c3b2a1",
        name: "pulseops-rabbitmq",
        image: "rabbitmq:3.12-management-alpine",
        serviceName: "rabbitmq",
        hostId: "host_infra_db_01",
        status: "running",
        cpuPercent: 14.1,
        memoryUsageMb: 920,
        memoryLimitMb: 4096,
        networkRxKbps: 7200,
        networkTxKbps: 8100,
        restartCount: 0,
        uptimeSeconds: 3891000,
        ports: ["5672:5672", "15672:15672"],
        createdAt: now,
        updatedAt: now,
      },
    ];

    for (const c of defaultContainers) {
      this.containersStore.set(c.id, c);
    }
  }

  async listHosts(projectId: string): Promise<HostNode[]> {
    const list = Array.from(this.hostsStore.values()).filter(
      (h) => h.projectId === projectId || h.projectId === "default",
    );
    return list.sort((a, b) => a.hostname.localeCompare(b.hostname));
  }

  async listContainers(projectId: string): Promise<ContainerNode[]> {
    const list = Array.from(this.containersStore.values()).filter(
      (c) => c.projectId === projectId || c.projectId === "default",
    );
    return list.sort((a, b) => a.name.localeCompare(b.name));
  }

  async getDependencies(projectId: string): Promise<DependencyHealth[]> {
    return [
      {
        name: "RabbitMQ",
        status: "healthy",
        latencyMs: 1.8,
        connectionCount: 24,
        details: {
          version: "3.12.10",
          queuesTotal: 6,
          messagesReady: 42,
          messagesUnacknowledged: 8,
          publishRate: "340.5 msg/s",
          deliverRate: "338.2 msg/s",
        },
      },
      {
        name: "Redis",
        status: "healthy",
        latencyMs: 0.6,
        connectionCount: 18,
        details: {
          version: "7.2.4",
          usedMemoryHuman: "680.4M",
          maxMemoryHuman: "4.0G",
          opsPerSec: 1420,
          hitRate: "99.4%",
          connectedSlaves: 1,
        },
      },
      {
        name: "MongoDB",
        status: "healthy",
        latencyMs: 2.4,
        connectionCount: 32,
        details: {
          version: "7.0.5",
          replicaSet: "rs0",
          collections: 14,
          dataSizeMb: 4120,
          indexSizeMb: 580,
          currentOpCount: 3,
        },
      },
      {
        name: "Vault",
        status: "healthy",
        latencyMs: 3.1,
        connectionCount: 8,
        details: {
          version: "1.15.4",
          sealed: false,
          clusterName: "pulseops-vault-cluster",
          activeTime: "14d 8h",
          secretsLeased: 12,
        },
      },
    ];
  }

  async getOverview(projectId: string): Promise<InfrastructureOverview> {
    const hosts = await this.listHosts(projectId);
    const containers = await this.listContainers(projectId);
    const dependencies = await this.getDependencies(projectId);

    const healthyHosts = hosts.filter((h) => h.status === "healthy").length;
    const runningContainers = containers.filter((c) => c.status === "running").length;

    const avgCpuPercent =
      hosts.length > 0
        ? Number((hosts.reduce((acc, h) => acc + h.cpuPercent, 0) / hosts.length).toFixed(1))
        : 0;

    const avgMemoryPercent =
      hosts.length > 0
        ? Number((hosts.reduce((acc, h) => acc + h.memoryPercent, 0) / hosts.length).toFixed(1))
        : 0;

    return {
      totalHosts: hosts.length,
      healthyHosts,
      totalContainers: containers.length,
      runningContainers,
      avgCpuPercent,
      avgMemoryPercent,
      dependencies,
    };
  }
}
