import { describe, expect, it } from "vitest";
import { InfrastructureRepository } from "../../src/repositories/infrastructure.repository.js";

describe("InfrastructureRepository", () => {
  const repo = new InfrastructureRepository();

  it("lists all seeded host nodes", async () => {
    const hosts = await repo.listHosts("default");
    expect(hosts.length).toBeGreaterThanOrEqual(3);
    expect(hosts[0]?.hostname).toBeDefined();
    expect(hosts[0]?.cpuPercent).toBeGreaterThanOrEqual(0);
    expect(hosts[0]?.memoryPercent).toBeGreaterThanOrEqual(0);
  });

  it("lists all seeded docker container nodes with service mappings", async () => {
    const containers = await repo.listContainers("default");
    expect(containers.length).toBeGreaterThanOrEqual(5);
    expect(containers.some((c) => c.serviceName === "po-api-gateway")).toBe(true);
    expect(containers.some((c) => c.serviceName === "po-ingestion-service")).toBe(true);
  });

  it("reports live status for core infra dependencies", async () => {
    const deps = await repo.getDependencies("default");
    expect(deps.length).toBe(4);
    const depNames = deps.map((d) => d.name);
    expect(depNames).toContain("RabbitMQ");
    expect(depNames).toContain("Redis");
    expect(depNames).toContain("MongoDB");
    expect(depNames).toContain("Vault");
    expect(deps.every((d) => d.status === "healthy")).toBe(true);
  });

  it("computes fleet-wide cluster overview", async () => {
    const overview = await repo.getOverview("default");
    expect(overview.totalHosts).toBeGreaterThanOrEqual(3);
    expect(overview.healthyHosts).toBe(overview.totalHosts);
    expect(overview.totalContainers).toBeGreaterThanOrEqual(5);
    expect(overview.runningContainers).toBe(overview.totalContainers);
    expect(overview.avgCpuPercent).toBeGreaterThan(0);
    expect(overview.avgMemoryPercent).toBeGreaterThan(0);
    expect(overview.dependencies.length).toBe(4);
  });
});
