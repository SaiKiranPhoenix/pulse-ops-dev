import { randomUUID } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";

const scenarios = ["normal", "errors", "latency", "rate-limit", "all"];
const rootEnv = readDotEnv(".env");
const config = {
  apiBaseUrl:
    process.env.PULSEOPS_API_BASE_URL ??
    process.env.API_BASE_URL ??
    rootEnv.PULSEOPS_API_BASE_URL ??
    rootEnv.API_BASE_URL ??
    "http://localhost:4000",
  uiUrl: process.env.PULSEOPS_UI_URL ?? rootEnv.PULSEOPS_UI_URL ?? "http://localhost:3000",
  apiKey: process.env.PULSEOPS_API_KEY ?? process.env.API_KEY ?? rootEnv.PULSEOPS_API_KEY,
  environment: process.env.PULSEOPS_ENVIRONMENT ?? rootEnv.PULSEOPS_ENVIRONMENT ?? "production",
  projectId: process.env.PULSEOPS_PROJECT_ID ?? rootEnv.PULSEOPS_PROJECT_ID,
  scenario:
    readArg("scenario") ??
    process.env.PULSEOPS_TRAFFIC_SCENARIO ??
    rootEnv.PULSEOPS_TRAFFIC_SCENARIO ??
    "all",
  source:
    process.env.PULSEOPS_TRAFFIC_SOURCE ?? rootEnv.PULSEOPS_TRAFFIC_SOURCE ?? "demo-checkout-api",
  normalEvents: readNumber("PULSEOPS_TRAFFIC_EVENTS", 12),
  errorEvents: readNumber("PULSEOPS_TRAFFIC_ERRORS", 3),
  metricEvents: readNumber("PULSEOPS_TRAFFIC_METRICS", 8),
  burstEvents: readNumber("PULSEOPS_TRAFFIC_BURST", 80),
};

const runId = createRunId();

try {
  await main();
} catch (error) {
  console.error("");
  console.error("Demo traffic generation failed.");
  console.error(error instanceof Error ? error.message : String(error));
  console.error("");
  console.error("Make sure the stack is running and provide a raw ingestion API key:");
  console.error('  $env:PULSEOPS_API_KEY="<raw-api-key-shown-once>"');
  console.error("  pnpm demo:traffic");
  console.error("");
  process.exitCode = 1;
}

async function main() {
  validateConfig();

  console.log("PulseOps demo traffic");
  console.log(`API: ${config.apiBaseUrl}`);
  console.log(`Scenario: ${config.scenario}`);
  console.log(`Source: ${config.source}`);
  console.log(`Environment: ${config.environment}`);
  console.log("");

  const selectedScenarios = config.scenario === "all" ? scenarios.slice(0, -1) : [config.scenario];
  const results = [];

  for (const scenario of selectedScenarios) {
    results.push(await runScenario(scenario));
  }

  const accepted = results.reduce((total, result) => total + result.accepted, 0);
  const limited = results.reduce((total, result) => total + result.limited, 0);

  console.log("");
  console.log("Demo traffic complete.");
  console.log(`Accepted events: ${accepted}`);
  console.log(`Rate-limited attempts: ${limited}`);
  console.log("");
  printDashboardUrls();
  printExpectedResults();
}

async function runScenario(scenario) {
  switch (scenario) {
    case "normal":
      return step(`Send ${config.normalEvents} normal log events`, () => runNormalTraffic());
    case "errors":
      return step(`Send ${config.errorEvents} correlated error events`, () => runRepeatedErrors());
    case "latency":
      return step(`Send ${config.metricEvents} high-latency metrics`, () => runHighLatency());
    case "rate-limit":
      return step(`Send ${config.burstEvents} burst events for rate-limit visibility`, () =>
        runRateLimitBurst(),
      );
    default:
      throw new Error(`Unsupported scenario: ${scenario}`);
  }
}

async function runNormalTraffic() {
  let accepted = 0;

  for (let index = 0; index < config.normalEvents; index += 1) {
    await sendIngest("logs", {
      source: config.source,
      level: index % 5 === 0 ? "warn" : "info",
      message: index % 5 === 0 ? "demo checkout inventory was slow" : "demo checkout completed",
      fingerprint: `demo-normal-${runId}-${index}`,
      attributes: baseAttributes("normal", {
        route: "POST /checkout",
        statusCode: index % 5 === 0 ? 202 : 200,
      }),
    });
    accepted += 1;
  }

  return { accepted, limited: 0 };
}

async function runRepeatedErrors() {
  let accepted = 0;

  for (let index = 0; index < config.errorEvents; index += 1) {
    await sendIngest("errors", {
      source: config.source,
      name: "PaymentProviderTimeout",
      message: "demo payment provider request timed out",
      stack:
        "PaymentProviderTimeout: demo payment provider request timed out\n    at checkout.js:42:11",
      fingerprint: `demo-payment-provider-timeout-${runId}`,
      attributes: baseAttributes("errors", {
        route: "POST /payments",
        retryAttempt: index + 1,
      }),
    });
    accepted += 1;
  }

  return { accepted, limited: 0 };
}

async function runHighLatency() {
  let accepted = 0;
  const values = [920, 1_140, 1_360, 1_580, 1_820, 2_050, 2_240, 2_520];

  for (let index = 0; index < config.metricEvents; index += 1) {
    await sendIngest("metrics", {
      source: config.source,
      name: "checkout.latency",
      value: values[index % values.length],
      unit: "ms",
      fingerprint: `demo-checkout-latency-${runId}-${index}`,
      attributes: baseAttributes("latency", {
        route: "POST /checkout",
        percentile: index % 2 === 0 ? "p95" : "avg",
      }),
    });
    accepted += 1;
  }

  return { accepted, limited: 0 };
}

async function runRateLimitBurst() {
  const attempts = await Promise.allSettled(
    Array.from({ length: config.burstEvents }, (_, index) =>
      sendIngest(
        "logs",
        {
          source: config.source,
          level: "info",
          message: "demo burst request accepted for rate-limit visibility",
          fingerprint: `demo-rate-limit-${runId}-${index}`,
          attributes: baseAttributes("rate-limit", {
            route: "POST /bulk-demo",
            burstIndex: index,
          }),
        },
        [202, 429],
      ),
    ),
  );

  return attempts.reduce(
    (summary, attempt) => {
      if (attempt.status === "fulfilled" && attempt.value.status === 429) {
        return { accepted: summary.accepted, limited: summary.limited + 1 };
      }

      if (attempt.status === "fulfilled") {
        return { accepted: summary.accepted + 1, limited: summary.limited };
      }

      throw attempt.reason;
    },
    { accepted: 0, limited: 0 },
  );
}

async function sendIngest(kind, body, expectedStatuses = [202]) {
  const idempotencyKey = `demo-${kind}-${runId}-${randomUUID()}`;
  const response = await fetch(createUrl(`/ingest/${kind}`), {
    method: "POST",
    headers: {
      accept: "application/json",
      "content-type": "application/json",
      "idempotency-key": idempotencyKey,
      "x-api-key": config.apiKey,
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(20_000),
  });
  const parsed = await parseResponseBody(response);

  if (!expectedStatuses.includes(response.status)) {
    throw new Error(
      `POST /ingest/${kind} failed with HTTP ${response.status}: ${formatError(parsed)}`,
    );
  }

  return { status: response.status, data: parsed?.data };
}

function baseAttributes(scenario, extra = {}) {
  return {
    environment: config.environment,
    projectId: config.projectId,
    runId,
    scenario,
    service: config.source,
    traceId: `trace-${runId}`,
    ...extra,
  };
}

function printDashboardUrls() {
  console.log("Dashboard URLs:");
  console.log(`- Overview: ${config.uiUrl}/dashboard`);
  console.log(`- Logs: ${config.uiUrl}/dashboard/logs`);
  console.log(`- Errors: ${config.uiUrl}/dashboard/errors`);
  console.log(`- Metrics: ${config.uiUrl}/dashboard/metrics`);
  console.log(`- Incidents: ${config.uiUrl}/dashboard/alerts`);
  console.log(`- Workers and queues: ${config.uiUrl}/dashboard/workers`);
}

function printExpectedResults() {
  console.log("");
  console.log("Expected results:");
  console.log("- Logs show demo-checkout-api rows for normal and burst traffic.");
  console.log("- Errors groups show PaymentProviderTimeout after the repeated-error scenario.");
  console.log("- Incidents shows a repeated-error incident after the workers process the events.");
  console.log("- Metrics shows checkout.latency values above 900ms after the latency scenario.");
  console.log(
    "- Workers and queues show fresh processing activity, retry metadata, and DLQ visibility.",
  );
  console.log("");
  console.log("Typical local timing:");
  console.log(
    "- Ingestion acknowledgements return immediately after RabbitMQ accepts the messages.",
  );
  console.log("- Dashboard rows usually appear within 5 to 15 seconds once workers are running.");
  console.log("- Incident grouping usually appears within 10 to 30 seconds after repeated errors.");
}

function validateConfig() {
  if (typeof config.apiKey !== "string" || config.apiKey.trim().length === 0) {
    throw new Error("PULSEOPS_API_KEY or API_KEY is required.");
  }

  if (!scenarios.includes(config.scenario)) {
    throw new Error(`Scenario must be one of: ${scenarios.join(", ")}.`);
  }
}

function createUrl(pathname) {
  return new URL(pathname, ensureTrailingSlash(config.apiBaseUrl));
}

function ensureTrailingSlash(value) {
  return value.endsWith("/") ? value : `${value}/`;
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

function formatError(parsed) {
  if (parsed !== null && typeof parsed === "object" && "error" in parsed) {
    const error = parsed.error;

    if (error !== null && typeof error === "object") {
      return `${error.code ?? "ERROR"} ${error.message ?? ""}`.trim();
    }
  }

  return "unexpected response";
}

function readArg(name) {
  const prefix = `--${name}=`;
  return process.argv.find((arg) => arg.startsWith(prefix))?.slice(prefix.length);
}

function readNumber(name, fallback) {
  const raw = process.env[name] ?? rootEnv[name];
  const parsed = Number(raw ?? fallback);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
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
  console.log(`ok (${result.accepted} accepted, ${result.limited} limited)`);
  return result;
}

function createRunId() {
  return `${Date.now().toString(36)}${randomUUID().replaceAll("-", "").slice(0, 8)}`;
}
