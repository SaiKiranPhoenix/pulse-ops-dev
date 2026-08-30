import { randomUUID } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { setTimeout as delay } from "node:timers/promises";

const rootEnv = readDotEnv(".env");
const config = {
  apiBaseUrl:
    process.env.PULSEOPS_API_BASE_URL ??
    process.env.API_BASE_URL ??
    rootEnv.PULSEOPS_API_BASE_URL ??
    rootEnv.API_BASE_URL ??
    "http://localhost:4000",
  uiUrl: process.env.PULSEOPS_UI_URL ?? rootEnv.PULSEOPS_UI_URL ?? "http://localhost:3000",
  demoEmail:
    process.env.PULSEOPS_DEMO_EMAIL ?? rootEnv.PULSEOPS_DEMO_EMAIL ?? "demo@pulseops.local",
  demoPassword:
    process.env.PULSEOPS_DEMO_PASSWORD ?? rootEnv.PULSEOPS_DEMO_PASSWORD ?? "PulseOpsDemo1!",
  projectSlug:
    process.env.PULSEOPS_DEMO_PROJECT_SLUG ?? rootEnv.PULSEOPS_DEMO_PROJECT_SLUG ?? "pulseops-demo",
  timeoutMs: Number(
    process.env.PULSEOPS_DEMO_TIMEOUT_MS ?? rootEnv.PULSEOPS_DEMO_TIMEOUT_MS ?? 90_000,
  ),
};

const runId = createRunId();
const environment = "production";
const secretKey = `DEMO_SERVICE_TOKEN_${runId.toUpperCase()}`;
const secretValue = `seed-${randomUUID()}`;
const errorFingerprint = "demo-checkout-payment-provider-timeout";

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

try {
  await main();
} catch (error) {
  console.error("");
  console.error("Demo seed failed.");
  console.error(error instanceof Error ? error.message : String(error));
  console.error("");
  console.error("Make sure the stack is running first:");
  console.error("  pnpm stack:up");
  console.error("");
  process.exitCode = 1;
}

async function main() {
  console.log("PulseOps demo data seed");
  console.log(`API: ${config.apiBaseUrl}`);
  console.log("");

  await step("Check API gateway health", async () => {
    await waitFor("API gateway health", async () => {
      await requestHealth("/health");
      return true;
    });
  });

  await step("Register or reuse demo user", async () => {
    await registerOrReuseUser(config.demoEmail, config.demoPassword);
  });

  const session = await step("Login demo user", async () => {
    const data = await requestData("POST", "/auth/login", {
      body: {
        email: config.demoEmail,
        password: config.demoPassword,
      },
    });
    assertString(data.accessToken, "Login response did not include an access token.");
    return data;
  });
  const authHeaders = {
    authorization: `${session.tokenType ?? "Bearer"} ${session.accessToken}`,
  };

  const project = await step("Create or reuse demo project", async () => {
    return findOrCreateProject(authHeaders);
  });

  const apiKeyResult = await step("Create seed ingestion API key", async () => {
    const data = await requestData("POST", `/projects/${project.id}/api-keys`, {
      headers: authHeaders,
      body: {
        name: `demo-seed-${runId}`,
        scopes: ["errors:write", "logs:write", "metrics:write"],
      },
    });
    assertString(data.rawKey, "API key response did not include a one-time raw key.");
    return data;
  });

  await step("Seed telemetry events", async () => {
    await requestData("POST", "/ingest/logs", {
      headers: ingestionHeaders(apiKeyResult.rawKey, `seed-log-${runId}`),
      expectedStatuses: [202],
      body: {
        source: "checkout-api",
        level: "info",
        message: "demo checkout completed",
        fingerprint: "demo-checkout-success",
        attributes: {
          environment,
          runId,
          service: "checkout-api",
          traceId: `trace-${runId}`,
          spanId: `span-log-${runId}`,
        },
      },
    });

    await requestData("POST", "/ingest/metrics", {
      headers: ingestionHeaders(apiKeyResult.rawKey, `seed-metric-${runId}`),
      expectedStatuses: [202],
      body: {
        source: "checkout-api",
        name: "checkout.latency",
        value: 184,
        unit: "ms",
        fingerprint: "demo-checkout-latency",
        attributes: {
          environment,
          runId,
          service: "checkout-api",
          traceId: `trace-${runId}`,
          spanId: `span-metric-${runId}`,
        },
      },
    });

    for (let index = 0; index < 3; index += 1) {
      await requestData("POST", "/ingest/errors", {
        headers: ingestionHeaders(apiKeyResult.rawKey, `seed-error-${runId}-${index}`),
        expectedStatuses: [202],
        body: {
          source: "checkout-api",
          name: "PaymentProviderTimeout",
          message: "payment provider request timed out",
          fingerprint: errorFingerprint,
          attributes: {
            environment,
            runId,
            service: "checkout-api",
            traceId: `trace-${runId}`,
            spanId: `span-error-${index}-${runId}`,
          },
        },
      });
    }
  });

  await step("Seed vault secret and integration token", async () => {
    await requestData("POST", "/vault/secrets", {
      headers: authHeaders,
      body: {
        projectId: project.id,
        environment,
        key: secretKey,
        value: secretValue,
      },
    });

    const token = await requestData("POST", "/vault/tokens", {
      headers: authHeaders,
      body: {
        projectId: project.id,
        name: `demo-seed-token-${runId}`,
        scopes: ["secrets:read"],
        environments: [environment],
      },
    });
    assertString(token.rawToken, "Vault token response did not include a one-time raw token.");
  });

  await step("Wait for dashboard data", async () => {
    await waitFor("dashboard events", async () => {
      const data = await requestData("GET", `/dashboard/summary?projectId=${project.id}`, {
        headers: authHeaders,
      });
      return data.summary?.totalEvents >= 5;
    });
  });

  console.log("");
  console.log("Demo seed complete.");
  console.log(`Email: ${config.demoEmail}`);
  console.log(`Password: ${config.demoPassword}`);
  console.log(`Project id: ${project.id}`);
  console.log(`Dashboard: ${config.uiUrl}/dashboard`);
}

async function findOrCreateProject(headers) {
  const existing = await findProject(headers);

  if (existing !== null) {
    return existing;
  }

  try {
    const data = await requestData("POST", "/projects", {
      headers,
      body: {
        name: "PulseOps Demo",
        slug: config.projectSlug,
        description: "Local seeded project for development and demos.",
      },
    });
    assertString(data.project?.id, "Project response did not include an id.");
    return data.project;
  } catch (error) {
    if (error instanceof HttpError && error.status === 409) {
      const project = await findProject(headers);

      if (project !== null) {
        return project;
      }
    }

    throw error;
  }
}

async function findProject(headers) {
  const data = await requestData("GET", "/projects", { headers });
  const projects = Array.isArray(data.projects) ? data.projects : [];
  return projects.find((project) => project.slug === config.projectSlug) ?? null;
}

async function registerOrReuseUser(email, password) {
  try {
    await requestData("POST", "/auth/register", {
      expectedStatuses: [201],
      body: {
        email,
        password,
        name: "PulseOps Demo",
      },
    });
  } catch (error) {
    if (error instanceof HttpError && error.status === 409) {
      return;
    }

    throw error;
  }
}

function ingestionHeaders(rawKey, idempotencyKey) {
  return {
    "x-api-key": rawKey,
    "idempotency-key": idempotencyKey,
  };
}

async function requestHealth(pathname) {
  const response = await fetch(createUrl(pathname), {
    headers: {
      accept: "application/json",
    },
    signal: AbortSignal.timeout(10_000),
  });

  if (!response.ok) {
    throw new Error(`Health check failed with HTTP ${response.status}.`);
  }
}

async function requestData(method, pathname, options = {}) {
  const response = await fetch(createUrl(pathname), {
    method,
    headers: buildHeaders(options.headers, options.body),
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
    signal: AbortSignal.timeout(20_000),
  });
  const parsed = await parseResponseBody(response);
  const expectedStatuses = options.expectedStatuses ?? [200, 201, 202];

  if (!expectedStatuses.includes(response.status)) {
    throw new HttpError(
      response.status,
      `${method} ${pathname} failed with HTTP ${response.status}: ${formatError(parsed)}`,
    );
  }

  if (parsed === null || typeof parsed !== "object" || !("data" in parsed)) {
    throw new Error(`${method} ${pathname} did not return the standard API success envelope.`);
  }

  return parsed.data;
}

function buildHeaders(headers = {}, body) {
  return {
    accept: "application/json",
    ...(body === undefined ? {} : { "content-type": "application/json" }),
    ...headers,
  };
}

async function parseResponseBody(response) {
  const text = await response.text();

  if (text.length === 0) {
    return null;
  }

  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`Response from ${response.url} was not valid JSON.`);
  }
}

async function waitFor(label, predicate) {
  const startedAt = Date.now();
  let lastError = null;

  while (Date.now() - startedAt < config.timeoutMs) {
    try {
      if (await predicate()) {
        return;
      }
    } catch (error) {
      lastError = error;
    }

    await delay(1_500);
  }

  const detail = lastError instanceof Error ? ` Last error: ${lastError.message}` : "";
  throw new Error(`Timed out waiting for ${label}.${detail}`);
}

function assertString(value, message) {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(message);
  }
}

function formatError(parsed) {
  if (parsed !== null && typeof parsed === "object" && "error" in parsed) {
    const error = parsed.error;

    if (error !== null && typeof error === "object") {
      return `${error.code ?? "ERROR"} ${error.message ?? ""}`.trim();
    }
  }

  return "unexpected response";
}

function createUrl(pathname) {
  return new URL(pathname, ensureTrailingSlash(config.apiBaseUrl));
}

function ensureTrailingSlash(value) {
  return value.endsWith("/") ? value : `${value}/`;
}

function createRunId() {
  return `${Date.now().toString(36)}${randomUUID().replaceAll("-", "").slice(0, 8)}`;
}

function readDotEnv(filePath) {
  if (!existsSync(filePath)) {
    return {};
  }

  const values = {};
  const lines = readFileSync(filePath, "utf8").split(/\r?\n/);

  for (const line of lines) {
    const trimmed = line.trim();

    if (trimmed.length === 0 || trimmed.startsWith("#")) {
      continue;
    }

    const separatorIndex = trimmed.indexOf("=");

    if (separatorIndex === -1) {
      continue;
    }

    const key = trimmed.slice(0, separatorIndex).trim();
    const value = trimmed.slice(separatorIndex + 1).trim();

    values[key] = unquote(value);
  }

  return values;
}

function unquote(value) {
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }

  return value;
}

async function step(label, action) {
  process.stdout.write(`- ${label}... `);
  const result = await action();
  console.log("ok");
  return result;
}
