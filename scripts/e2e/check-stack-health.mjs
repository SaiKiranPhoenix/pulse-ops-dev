import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const requiredServices = [
  "mongodb",
  "redis",
  "rabbitmq",
  "mailhog",
  "po-ui",
  "po-api-gateway",
  "po-auth-project-service",
  "po-ingestion-service",
  "po-event-workers",
  "po-incident-service",
  "po-realtime-gateway",
  "po-vault-service",
  "po-audit-service",
  "po-ops-service",
];

const healthUrls = [
  process.env.PULSEOPS_E2E_UI_URL ?? "http://localhost:3000",
  process.env.PULSEOPS_API_BASE_URL ?? "http://localhost:4000/health",
  process.env.PULSEOPS_REALTIME_URL ?? "http://localhost:4130/health",
];

try {
  await main();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}

async function main() {
  if (process.env.PULSEOPS_SKIP_STACK_HEALTH === "1") {
    console.log("PulseOps stack health check skipped.");
    return;
  }

  await assertComposeServicesHealthy();
  await assertHealthUrlsReady();
  console.log("PulseOps stack health check passed.");
}

async function assertComposeServicesHealthy() {
  const { stdout } = await execFileAsync("docker", [
    "compose",
    "--profile",
    "apps",
    "ps",
    "--format",
    "json",
  ]);
  const services = stdout
    .split(/\r?\n/)
    .filter((line) => line.trim().length > 0)
    .map((line) => JSON.parse(line));

  const servicesByName = new Map(services.map((service) => [service.Service, service]));
  const missing = requiredServices.filter((serviceName) => !servicesByName.has(serviceName));

  if (missing.length > 0) {
    throw new Error(`Docker services are missing: ${missing.join(", ")}`);
  }

  const unhealthy = requiredServices.filter((serviceName) => {
    const service = servicesByName.get(serviceName);
    const state = String(service.State ?? "").toLowerCase();
    const health = String(service.Health ?? "").toLowerCase();
    return state !== "running" || (health.length > 0 && health !== "healthy");
  });

  if (unhealthy.length > 0) {
    throw new Error(`Docker services are not ready: ${unhealthy.join(", ")}`);
  }
}

async function assertHealthUrlsReady() {
  const failures = [];

  for (const url of healthUrls) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(5_000) });

      if (!response.ok) {
        failures.push(`${url} returned ${response.status}`);
      }
    } catch (error) {
      failures.push(`${url} failed: ${error instanceof Error ? error.message : "unknown"}`);
    }
  }

  if (failures.length > 0) {
    throw new Error(`PulseOps health URLs are not ready:\n${failures.join("\n")}`);
  }
}
