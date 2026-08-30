import {
  Activity,
  AlertTriangle,
  Clipboard,
  FileJson,
  Gauge,
  Network,
  Play,
  RefreshCw,
  Route,
  ServerCog,
  ShieldCheck,
  Zap,
  type LucideIcon,
} from "lucide-react";
import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ingestError, ingestLog, ingestMetric } from "@/features/ingestion/api";
import {
  getGatewayHealth,
  getOpenApiDocument,
  type GatewayHealth,
  type OpenApiDocument,
  type UpstreamHealth,
} from "@/features/platform/api";
import { apiClient, getApiErrorMessage } from "@/lib/api-client";
import { realtimeUrl } from "@/lib/socket-client";
import { cn } from "@/lib/utils";
import { useDashboardContext, type DashboardEnvironment } from "./DashboardLayout";

type RouteEntry = {
  readonly method: string;
  readonly path: string;
  readonly summary: string;
};

const routeMethods = ["all", "get", "post", "put", "delete", "patch"] as const;
type RouteMethod = (typeof routeMethods)[number];
type DemoScenarioId = "errors" | "latency" | "normal" | "rate-limit";

type DemoScenario = {
  readonly description: string;
  readonly expected: string;
  readonly icon: LucideIcon;
  readonly id: DemoScenarioId;
  readonly label: string;
  readonly target: string;
};

type DemoTrafficResult = {
  readonly accepted: number;
  readonly limited: number;
  readonly expected: string;
  readonly target: string;
};

const coverageItems = [
  {
    backend: "Auth and sessions",
    http: "/auth/*",
    realtime: "-",
    ui: "/dashboard/account",
    label: "Account",
    status: "complete",
  },
  {
    backend: "Project management",
    http: "/projects/*",
    realtime: "-",
    ui: "/dashboard/projects",
    label: "Projects",
    status: "complete",
  },
  {
    backend: "Telemetry ingestion",
    http: "/ingest/logs, /ingest/errors, /ingest/metrics",
    realtime: "event.created",
    ui: "/dashboard/setup",
    label: "Setup",
    status: "complete",
  },
  {
    backend: "Logs and events",
    http: "/dashboard/events",
    realtime: "event.created",
    ui: "/dashboard/logs",
    label: "Logs",
    status: "complete",
  },
  {
    backend: "Errors",
    http: "/dashboard/error-groups",
    realtime: "event.created",
    ui: "/dashboard/errors",
    label: "Errors",
    status: "complete",
  },
  {
    backend: "Metrics",
    http: "/dashboard/metrics",
    realtime: "event.created",
    ui: "/dashboard/metrics",
    label: "Metrics",
    status: "complete",
  },
  {
    backend: "Traces/APM",
    http: "/dashboard/traces",
    realtime: "event.created",
    ui: "/dashboard/traces",
    label: "Traces",
    status: "complete",
  },
  {
    backend: "Incidents",
    http: "/incidents/*",
    realtime: "incident.updated",
    ui: "/dashboard/alerts",
    label: "Incidents",
    status: "complete",
  },
  {
    backend: "Workers and queues",
    http: "/ops/*, /dashboard/workers, /dashboard/queues",
    realtime: "worker.heartbeat, queue.status",
    ui: "/dashboard/workers",
    label: "Workers",
    status: "complete",
  },
  {
    backend: "Vault core",
    http: "/vault/*, /integrations/vault/*",
    realtime: "-",
    ui: "/dashboard/vault",
    label: "Vault",
    status: "complete",
  },
  {
    backend: "Vault audit",
    http: "/audit/events",
    realtime: "vault.audit.created",
    ui: "/dashboard/vault-audit",
    label: "Vault Audit",
    status: "complete",
  },
  {
    backend: "Gateway and contracts",
    http: "/health/services, /openapi.json",
    realtime: "-",
    ui: "/dashboard/platform",
    label: "Platform",
    status: "complete",
  },
] as const;

const demoScenarios: readonly DemoScenario[] = [
  {
    id: "normal",
    label: "Normal traffic",
    description: "Sends checkout logs with info and warning levels.",
    expected: "Logs and Overview show fresh demo-checkout-ui rows.",
    target: "/dashboard/logs",
    icon: Activity,
  },
  {
    id: "errors",
    label: "Repeated errors",
    description: "Sends correlated payment timeout errors.",
    expected: "Errors groups update, then an incident appears after processing.",
    target: "/dashboard/errors",
    icon: AlertTriangle,
  },
  {
    id: "latency",
    label: "High latency",
    description: "Sends checkout.latency metrics above the warning range.",
    expected: "Metrics shows high checkout latency samples.",
    target: "/dashboard/metrics",
    icon: Gauge,
  },
  {
    id: "rate-limit",
    label: "Rate-limit burst",
    description: "Sends a burst of log events and counts accepted versus limited attempts.",
    expected: "Setup and dashboard counters show rate-limit activity.",
    target: "/dashboard/setup",
    icon: Zap,
  },
];

export function PlatformPage() {
  const { selectedEnvironment, selectedProject } = useDashboardContext();
  const [health, setHealth] = useState<GatewayHealth | null>(null);
  const [openApi, setOpenApi] = useState<OpenApiDocument | null>(null);
  const [selectedService, setSelectedService] = useState<UpstreamHealth | null>(null);
  const [routeSearch, setRouteSearch] = useState("");
  const [routeMethod, setRouteMethod] = useState<RouteMethod>("all");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [demoApiKey, setDemoApiKey] = useState("");
  const [lastDemoResult, setLastDemoResult] = useState<DemoTrafficResult | null>(null);
  const [activeDemoScenario, setActiveDemoScenario] = useState<DemoScenarioId | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  async function loadPlatform(): Promise<void> {
    setIsLoading(true);
    setError(null);

    try {
      const [nextHealth, nextOpenApi] = await Promise.all([
        getGatewayHealth(),
        getOpenApiDocument(),
      ]);
      setHealth(nextHealth);
      setOpenApi(nextOpenApi);
      setSelectedService((current) =>
        current === null
          ? (nextHealth.services[0] ?? null)
          : (nextHealth.services.find((service) => service.name === current.name) ??
            nextHealth.services[0] ??
            null),
      );
    } catch (requestError) {
      setError(getApiErrorMessage(requestError));
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadPlatform();
    const interval = window.setInterval(() => {
      void loadPlatform();
    }, 30_000);

    return () => window.clearInterval(interval);
  }, []);

  const routes = useMemo(() => toRouteEntries(openApi), [openApi]);
  const filteredRoutes = useMemo(
    () =>
      routes.filter((entry) => {
        const searchable = `${entry.method} ${entry.path} ${entry.summary}`.toLowerCase();

        return (
          (routeMethod === "all" || entry.method === routeMethod) &&
          (routeSearch.trim().length === 0 || searchable.includes(routeSearch.trim().toLowerCase()))
        );
      }),
    [routeMethod, routeSearch, routes],
  );
  const unavailableServices = health?.services.filter((service) => service.status !== "ok") ?? [];
  const avgLatency =
    health === null || health.services.length === 0
      ? 0
      : Math.round(
          health.services.reduce((total, service) => total + service.latencyMs, 0) /
            health.services.length,
        );
  const runtimeConfig = [
    `PULSEOPS_API_BASE_URL=${String(apiClient.defaults.baseURL ?? "http://localhost:4000")}`,
    `PULSEOPS_REALTIME_URL=${realtimeUrl}`,
    "PULSEOPS_UI_MODE=local",
  ].join("\n");

  async function copy(value: string, nextMessage: string): Promise<void> {
    await navigator.clipboard.writeText(value);
    setMessage(nextMessage);
  }

  async function sendDemoTraffic(scenarioId: DemoScenarioId): Promise<void> {
    const apiKey = demoApiKey.trim();

    if (apiKey.length === 0) {
      setError("Paste a raw ingestion API key before sending demo traffic.");
      setMessage(null);
      return;
    }

    if (selectedProject === null) {
      setError("Create or select a project before sending demo traffic.");
      setMessage(null);
      return;
    }

    const scenario = demoScenarios.find((item) => item.id === scenarioId);

    if (scenario === undefined) {
      return;
    }

    setActiveDemoScenario(scenarioId);
    setError(null);
    setMessage(null);
    setLastDemoResult(null);

    try {
      const result = await runDemoScenario({
        apiKey,
        environment: selectedEnvironment,
        scenario,
      });
      setLastDemoResult(result);
      setMessage(
        `${scenario.label} sent: ${result.accepted} accepted${
          result.limited > 0 ? `, ${result.limited} limited` : ""
        }. Expected result: ${result.expected}`,
      );
    } catch (requestError) {
      setError(getApiErrorMessage(requestError));
    } finally {
      setActiveDemoScenario(null);
    }
  }

  return (
    <main className="mx-auto flex max-w-7xl flex-col gap-5">
      <header className="flex flex-col gap-3 border-b border-slate-200 pb-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-sm font-medium text-cyan-700">Control plane</p>
          <h1 className="text-2xl font-semibold tracking-normal">Platform integration</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
            Verify backend availability, gateway route coverage, realtime channels, and the UI
            surfaces wired to each service.
          </p>
        </div>
        <Button
          className="w-auto"
          disabled={isLoading}
          onClick={() => void loadPlatform()}
          type="button"
          variant="outline"
        >
          <RefreshCw className={cn("h-4 w-4", isLoading && "animate-spin")} />
          Refresh
        </Button>
      </header>

      {message !== null ? (
        <div className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {message}
        </div>
      ) : null}

      {error !== null ? (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      <section className="grid gap-3 md:grid-cols-4">
        <Summary
          icon={<ServerCog className="h-4 w-4" />}
          label="Gateway"
          tone={health?.status === "ok" ? "good" : "warn"}
          value={health?.status ?? "unknown"}
        />
        <Summary
          icon={<Network className="h-4 w-4" />}
          label="Services"
          value={health?.services.length ?? 0}
        />
        <Summary
          icon={<AlertTriangle className="h-4 w-4" />}
          label="Unavailable"
          tone={unavailableServices.length === 0 ? "good" : "bad"}
          value={unavailableServices.length}
        />
        <Summary
          icon={<Activity className="h-4 w-4" />}
          label="Avg latency"
          value={`${avgLatency}ms`}
        />
      </section>

      <section className="grid gap-4 rounded-md border border-slate-200 bg-white p-4 xl:grid-cols-[20rem_1fr]">
        <div>
          <div className="flex items-center gap-2">
            <Play className="h-4 w-4 text-cyan-700" />
            <h2 className="text-sm font-semibold uppercase tracking-normal text-slate-500">
              Demo traffic
            </h2>
          </div>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Trigger the same local demo scenarios from the browser for the selected project and
            environment.
          </p>
          <label className="mt-4 block">
            <span className="text-xs font-semibold uppercase tracking-normal text-slate-500">
              Ingestion API key
            </span>
            <Input
              className="mt-2"
              onChange={(event) => setDemoApiKey(event.target.value)}
              placeholder="Paste raw key shown once"
              type="password"
              value={demoApiKey}
            />
          </label>
          <dl className="mt-4 grid gap-2 text-sm">
            <Detail label="Project" value={selectedProject?.name ?? "No project selected"} />
            <Detail label="Environment" value={selectedEnvironment} />
          </dl>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          {demoScenarios.map((scenario) => {
            const Icon = scenario.icon;
            const isActive = activeDemoScenario === scenario.id;

            return (
              <article
                className="rounded-md border border-slate-200 bg-slate-50 p-3"
                key={scenario.id}
              >
                <div className="flex items-start gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-cyan-200 bg-cyan-50 text-cyan-700">
                    <Icon className="h-4 w-4" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-950">{scenario.label}</p>
                    <p className="mt-1 text-sm leading-5 text-slate-600">{scenario.description}</p>
                  </div>
                </div>
                <p className="mt-3 text-xs leading-5 text-slate-500">{scenario.expected}</p>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <Button
                    className="w-auto"
                    disabled={activeDemoScenario !== null}
                    onClick={() => void sendDemoTraffic(scenario.id)}
                    type="button"
                    variant="outline"
                  >
                    <Play className={cn("h-4 w-4", isActive && "animate-pulse")} />
                    {isActive ? "Sending" : "Run"}
                  </Button>
                  <Link
                    className="text-sm font-medium text-cyan-700 hover:text-cyan-900"
                    to={scenario.target}
                  >
                    Open result
                  </Link>
                </div>
              </article>
            );
          })}
        </div>

        {lastDemoResult !== null ? (
          <div className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800 xl:col-span-2">
            {lastDemoResult.accepted} accepted
            {lastDemoResult.limited > 0 ? `, ${lastDemoResult.limited} limited` : ""}. Open{" "}
            <Link className="font-semibold underline" to={lastDemoResult.target}>
              the target view
            </Link>{" "}
            to verify the result.
          </div>
        ) : null}
      </section>

      <section className="grid gap-4 xl:grid-cols-[1fr_24rem]">
        <div className="rounded-md border border-slate-200 bg-white">
          <div className="flex items-center gap-2 border-b border-slate-100 px-4 py-3">
            <ServerCog className="h-4 w-4 text-cyan-700" />
            <h2 className="text-sm font-semibold uppercase tracking-normal text-slate-500">
              Service health
            </h2>
          </div>

          {health === null ? (
            <p className="px-4 py-6 text-sm text-slate-500">
              {isLoading ? "Loading service health" : "No service health returned"}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <div className="min-w-[46rem]">
                <div className="grid grid-cols-[11rem_1fr_7rem_7rem_7rem] gap-3 border-b border-slate-100 px-4 py-3 text-xs font-semibold uppercase tracking-normal text-slate-500">
                  <span>Service</span>
                  <span>URL</span>
                  <span>Status</span>
                  <span>Code</span>
                  <span className="text-right">Latency</span>
                </div>
                <div className="divide-y divide-slate-100">
                  {health.services.map((service) => (
                    <button
                      className="grid w-full grid-cols-[11rem_1fr_7rem_7rem_7rem] items-center gap-3 px-4 py-3 text-left transition hover:bg-slate-50"
                      key={service.name}
                      onClick={() => setSelectedService(service)}
                      type="button"
                    >
                      <span className="truncate text-sm font-semibold text-slate-900">
                        {service.name}
                      </span>
                      <span className="truncate font-mono text-xs text-slate-500">
                        {service.url}
                      </span>
                      <StatusBadge status={service.status} />
                      <span className="font-mono text-sm text-slate-600">
                        {service.statusCode ?? "-"}
                      </span>
                      <span className="text-right font-mono text-sm text-slate-600">
                        {service.latencyMs}ms
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        <aside className="rounded-md border border-slate-200 bg-white p-4">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-cyan-700" />
            <h2 className="text-sm font-semibold uppercase tracking-normal text-slate-500">
              Runtime config
            </h2>
          </div>
          <pre className="mt-4 overflow-x-auto whitespace-pre-wrap break-words rounded-md bg-slate-950 p-3 text-xs leading-5 text-slate-100">
            {runtimeConfig}
          </pre>
          <Button
            className="mt-3"
            onClick={() => void copy(runtimeConfig, "Runtime config copied.")}
            type="button"
            variant="outline"
          >
            <Clipboard className="h-4 w-4" />
            Copy config
          </Button>

          {selectedService !== null ? (
            <dl className="mt-4 grid gap-3 rounded-md border border-slate-200 bg-slate-50 p-3 text-sm">
              <Detail label="Selected service" value={selectedService.name} />
              <Detail label="Base URL" value={selectedService.url} mono />
              <Detail label="Status" value={selectedService.status} />
              <Detail label="Latency" value={`${selectedService.latencyMs}ms`} />
            </dl>
          ) : null}
        </aside>
      </section>

      <section className="grid gap-4 xl:grid-cols-[1fr_24rem]">
        <div className="rounded-md border border-slate-200 bg-white">
          <div className="flex flex-col gap-3 border-b border-slate-100 px-4 py-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-2">
              <Route className="h-4 w-4 text-cyan-700" />
              <h2 className="text-sm font-semibold uppercase tracking-normal text-slate-500">
                Gateway route catalog
              </h2>
            </div>
            <div className="grid gap-2 sm:grid-cols-[1fr_8rem]">
              <Input
                onChange={(event) => setRouteSearch(event.target.value)}
                placeholder="Search route or summary"
                value={routeSearch}
              />
              <select
                className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm uppercase shadow-sm outline-none focus:ring-2 focus:ring-cyan-700"
                onChange={(event) => setRouteMethod(event.target.value as RouteMethod)}
                value={routeMethod}
              >
                {routeMethods.map((method) => (
                  <option key={method} value={method}>
                    {method}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {filteredRoutes.length === 0 ? (
            <p className="px-4 py-6 text-sm text-slate-500">
              {isLoading ? "Loading route catalog" : "No routes match the current filters"}
            </p>
          ) : (
            <div className="divide-y divide-slate-100">
              {filteredRoutes.map((entry) => (
                <article
                  className="grid gap-2 px-4 py-3 lg:grid-cols-[5rem_15rem_1fr]"
                  key={`${entry.method}:${entry.path}`}
                >
                  <span className="w-fit rounded-md border border-slate-200 bg-slate-50 px-2 py-1 font-mono text-xs font-semibold uppercase text-slate-700">
                    {entry.method}
                  </span>
                  <span className="break-all font-mono text-sm text-slate-900">{entry.path}</span>
                  <span className="text-sm text-slate-600">{entry.summary}</span>
                </article>
              ))}
            </div>
          )}
        </div>

        <aside className="rounded-md border border-slate-200 bg-white p-4">
          <div className="flex items-center gap-2">
            <FileJson className="h-4 w-4 text-cyan-700" />
            <h2 className="text-sm font-semibold uppercase tracking-normal text-slate-500">
              OpenAPI
            </h2>
          </div>
          <dl className="mt-4 grid gap-3 text-sm">
            <Detail label="Title" value={openApi?.info.title ?? "-"} />
            <Detail label="Version" value={openApi?.info.version ?? "-"} />
            <Detail label="Spec" value={openApi?.openapi ?? "-"} />
            <Detail label="Routes" value={String(routes.length)} />
          </dl>
          <Button
            className="mt-4"
            disabled={openApi === null}
            onClick={() =>
              openApi === null
                ? undefined
                : void copy(JSON.stringify(openApi, null, 2), "OpenAPI document copied.")
            }
            type="button"
            variant="outline"
          >
            <Clipboard className="h-4 w-4" />
            Copy OpenAPI
          </Button>
        </aside>
      </section>

      <section className="rounded-md border border-slate-200 bg-white">
        <div className="flex items-center gap-2 border-b border-slate-100 px-4 py-3">
          <Network className="h-4 w-4 text-cyan-700" />
          <h2 className="text-sm font-semibold uppercase tracking-normal text-slate-500">
            Backend to UI coverage
          </h2>
        </div>
        <div className="overflow-x-auto">
          <div className="min-w-[64rem] divide-y divide-slate-100">
            {coverageItems.map((item) => (
              <article
                className="grid grid-cols-[13rem_18rem_14rem_10rem_8rem] items-center gap-3 px-4 py-3"
                key={item.backend}
              >
                <div>
                  <p className="text-sm font-semibold text-slate-900">{item.backend}</p>
                  <p className="mt-1 text-xs capitalize text-emerald-700">{item.status}</p>
                </div>
                <p className="break-all font-mono text-xs text-slate-600">{item.http}</p>
                <p className="break-all font-mono text-xs text-slate-600">{item.realtime}</p>
                <Link
                  className="text-sm font-medium text-cyan-700 hover:text-cyan-900"
                  to={item.ui}
                >
                  {item.label}
                </Link>
                <span className="w-fit rounded-md border border-emerald-200 bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-700">
                  wired
                </span>
              </article>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}

async function runDemoScenario({
  apiKey,
  environment,
  scenario,
}: {
  readonly apiKey: string;
  readonly environment: DashboardEnvironment;
  readonly scenario: DemoScenario;
}): Promise<DemoTrafficResult> {
  const runId = crypto.randomUUID();

  switch (scenario.id) {
    case "normal": {
      for (let index = 0; index < 8; index += 1) {
        await ingestLog(
          { apiKey, idempotencyKey: `ui-demo-normal-${runId}-${index}` },
          {
            source: "demo-checkout-ui",
            level: index % 5 === 0 ? "warn" : "info",
            message:
              index % 5 === 0 ? "demo checkout inventory was slow" : "demo checkout completed",
            fingerprint: `ui-demo-normal-${runId}-${index}`,
            attributes: {
              environment,
              route: "POST /checkout",
              runId,
              scenario: scenario.id,
              service: "demo-checkout-ui",
              statusCode: index % 5 === 0 ? 202 : 200,
              traceId: `trace-${runId}`,
            },
          },
        );
      }

      return { accepted: 8, limited: 0, expected: scenario.expected, target: scenario.target };
    }

    case "errors": {
      for (let index = 0; index < 3; index += 1) {
        await ingestError(
          { apiKey, idempotencyKey: `ui-demo-error-${runId}-${index}` },
          {
            source: "demo-checkout-ui",
            name: "PaymentProviderTimeout",
            message: "demo payment provider request timed out",
            stack:
              "PaymentProviderTimeout: demo payment provider request timed out\n    at checkout-ui.ts:42:11",
            fingerprint: `ui-demo-payment-provider-timeout-${runId}`,
            attributes: {
              environment,
              route: "POST /payments",
              runId,
              scenario: scenario.id,
              service: "demo-checkout-ui",
              traceId: `trace-${runId}`,
            },
          },
        );
      }

      return { accepted: 3, limited: 0, expected: scenario.expected, target: scenario.target };
    }

    case "latency": {
      const values = [940, 1_180, 1_420, 1_730, 2_050, 2_340];

      for (let index = 0; index < values.length; index += 1) {
        await ingestMetric(
          { apiKey, idempotencyKey: `ui-demo-latency-${runId}-${index}` },
          {
            source: "demo-checkout-ui",
            name: "checkout.latency",
            value: values[index] ?? 940,
            unit: "ms",
            fingerprint: `ui-demo-checkout-latency-${runId}-${index}`,
            attributes: {
              environment,
              percentile: index % 2 === 0 ? "p95" : "avg",
              route: "POST /checkout",
              runId,
              scenario: scenario.id,
              service: "demo-checkout-ui",
              traceId: `trace-${runId}`,
            },
          },
        );
      }

      return {
        accepted: values.length,
        limited: 0,
        expected: scenario.expected,
        target: scenario.target,
      };
    }

    case "rate-limit": {
      const attempts = await Promise.allSettled(
        Array.from({ length: 40 }, (_, index) =>
          ingestLog(
            { apiKey, idempotencyKey: `ui-demo-burst-${runId}-${index}` },
            {
              source: "demo-checkout-ui",
              level: "info",
              message: "demo burst request accepted for rate-limit visibility",
              fingerprint: `ui-demo-rate-limit-${runId}-${index}`,
              attributes: {
                burstIndex: index,
                environment,
                route: "POST /bulk-demo",
                runId,
                scenario: scenario.id,
                service: "demo-checkout-ui",
                traceId: `trace-${runId}`,
              },
            },
          ),
        ),
      );

      return attempts.reduce(
        (summary, attempt) => {
          if (attempt.status === "fulfilled") {
            return { ...summary, accepted: summary.accepted + 1 };
          }

          if (isRateLimitError(attempt.reason)) {
            return { ...summary, limited: summary.limited + 1 };
          }

          throw attempt.reason;
        },
        { accepted: 0, limited: 0, expected: scenario.expected, target: scenario.target },
      );
    }
  }
}

function isRateLimitError(error: unknown): boolean {
  const message = getApiErrorMessage(error).toLowerCase();
  return message.includes("rate limit") || message.includes("429");
}

function Summary({
  icon,
  label,
  tone = "neutral",
  value,
}: {
  readonly icon: ReactNode;
  readonly label: string;
  readonly tone?: "bad" | "good" | "neutral" | "warn";
  readonly value: number | string;
}) {
  return (
    <div className="rounded-md border border-slate-200 bg-white p-4">
      <div
        className={cn(
          "flex h-9 w-9 items-center justify-center rounded-md border",
          tone === "good" && "border-emerald-200 bg-emerald-50 text-emerald-700",
          tone === "warn" && "border-amber-200 bg-amber-50 text-amber-700",
          tone === "bad" && "border-red-200 bg-red-50 text-red-700",
          tone === "neutral" && "border-slate-200 bg-slate-50 text-slate-700",
        )}
      >
        {icon}
      </div>
      <p className="mt-3 text-sm font-medium text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-semibold capitalize tabular-nums text-slate-950">{value}</p>
    </div>
  );
}

function StatusBadge({ status }: { readonly status: UpstreamHealth["status"] }) {
  return (
    <span
      className={cn(
        "w-fit rounded-md border px-2 py-1 text-xs font-medium capitalize",
        status === "ok"
          ? "border-emerald-200 bg-emerald-50 text-emerald-700"
          : "border-red-200 bg-red-50 text-red-700",
      )}
    >
      {status}
    </span>
  );
}

function Detail({
  label,
  mono = false,
  value,
}: {
  readonly label: string;
  readonly mono?: boolean;
  readonly value: string;
}) {
  return (
    <div>
      <dt className="text-xs font-semibold uppercase tracking-normal text-slate-500">{label}</dt>
      <dd className={cn("mt-1 break-words text-slate-900", mono && "font-mono text-xs")}>
        {value}
      </dd>
    </div>
  );
}

function toRouteEntries(openApi: OpenApiDocument | null): RouteEntry[] {
  if (openApi === null) {
    return [];
  }

  return Object.entries(openApi.paths)
    .flatMap(([path, methods]) =>
      Object.entries(methods).map(([method, operation]) => ({
        method,
        path,
        summary: operation.summary ?? "Gateway route",
      })),
    )
    .sort((left, right) =>
      left.path === right.path
        ? left.method.localeCompare(right.method)
        : left.path.localeCompare(right.path),
    );
}
