import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  Boxes,
  CheckCircle2,
  Circle,
  GitBranch,
  KeyRound,
  LineChart,
  LockKeyhole,
  PlugZap,
  RadioTower,
  RefreshCw,
  SearchCode,
  ServerCog,
  Terminal,
  Workflow,
  type LucideIcon,
} from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { listApiKeys, type ApiKey, type Project } from "@/features/auth/api";
import {
  getDashboardSummary,
  getIngestionStats,
  getMetricSummary,
  getQueueStatus,
  getTraceSummary,
  getWorkerStatus,
  listDashboardEvents,
  listDashboardIncidents,
  type DashboardEvent,
  type DashboardIncident,
  type DashboardSummary,
  type IngestionStats,
  type MetricSummary,
  type QueueStatus,
  type RealtimeEventCreated,
  type RealtimeIncidentUpdate,
  type TraceSummary,
  type WorkerHealth,
} from "@/features/dashboards/api";
import { getGatewayHealth, type GatewayHealth } from "@/features/platform/api";
import {
  listSecrets,
  listVaultTokens,
  type VaultSecretMetadata,
  type VaultToken,
} from "@/features/vault/api";
import { createPulseOpsSocket, joinProjectRoom, leaveProjectRoom } from "@/lib/socket-client";
import { cn } from "@/lib/utils";
import { formatRelativeTime, severityClass } from "./dashboard-utils";
import { useDashboardContext } from "./DashboardLayout";

type DashboardState = {
  readonly project: Project | null;
  readonly summary: DashboardSummary | null;
  readonly events: DashboardEvent[];
  readonly incidents: DashboardIncident[];
  readonly workers: WorkerHealth[];
  readonly queues: QueueStatus[];
  readonly ingestion: IngestionStats | null;
  readonly metrics: MetricSummary | null;
  readonly traces: TraceSummary | null;
  readonly platform: GatewayHealth | null;
  readonly apiKeys: ApiKey[];
  readonly vaultSecrets: VaultSecretMetadata[];
  readonly vaultTokens: VaultToken[];
  readonly unavailableAreas: string[];
  readonly lastLoadedAt: string | null;
};

const emptyDashboard: DashboardState = {
  project: null,
  summary: null,
  events: [],
  incidents: [],
  workers: [],
  queues: [],
  ingestion: null,
  metrics: null,
  traces: null,
  platform: null,
  apiKeys: [],
  vaultSecrets: [],
  vaultTokens: [],
  unavailableAreas: [],
  lastLoadedAt: null,
};

export function OverviewPage() {
  const { selectedEnvironment, selectedProject, selectedTimeRange } = useDashboardContext();
  const [dashboard, setDashboard] = useState<DashboardState>(emptyDashboard);
  const [isLoading, setIsLoading] = useState(true);
  const [connectionState, setConnectionState] = useState("offline");

  async function loadDashboard(): Promise<void> {
    setIsLoading(true);

    const project = selectedProject;

    if (project === null) {
      setDashboard(emptyDashboard);
      setIsLoading(false);
      return;
    }

    const unavailableAreas: string[] = [];

    const [
      summary,
      events,
      incidents,
      workerStatus,
      queueStatus,
      ingestion,
      metrics,
      traces,
      platform,
      apiKeys,
      vaultSecrets,
      vaultTokens,
    ] = await Promise.all([
      readOrDefault(
        "dashboard summary",
        () => getDashboardSummary(project.id),
        emptySummary(project.id),
        unavailableAreas,
      ),
      readOrDefault("events", () => listDashboardEvents(project.id), [], unavailableAreas),
      readOrDefault("incidents", () => listDashboardIncidents(project.id), [], unavailableAreas),
      readOrDefault("workers", () => getWorkerStatus(), { workers: [] }, unavailableAreas),
      readOrDefault("queues", () => getQueueStatus(), { queues: [] }, unavailableAreas),
      readOrDefault(
        "ingestion",
        () =>
          getIngestionStats(project.id, {
            environment: selectedEnvironment,
            timeRange: selectedTimeRange,
          }),
        null,
        unavailableAreas,
      ),
      readOrDefault(
        "metrics",
        () =>
          getMetricSummary(project.id, {
            environment: selectedEnvironment,
            timeRange: selectedTimeRange,
          }),
        null,
        unavailableAreas,
      ),
      readOrDefault(
        "traces",
        () =>
          getTraceSummary(project.id, {
            environment: selectedEnvironment,
            timeRange: selectedTimeRange,
          }),
        null,
        unavailableAreas,
      ),
      readOrDefault("platform", () => getGatewayHealth(), null, unavailableAreas),
      readOrDefault("API keys", () => listApiKeys(project.id), [], unavailableAreas),
      readOrDefault(
        "vault secrets",
        () => listSecrets(project.id, selectedEnvironment),
        [],
        unavailableAreas,
      ),
      readOrDefault("vault tokens", () => listVaultTokens(project.id), [], unavailableAreas),
    ]);

    setDashboard({
      project,
      summary,
      events,
      incidents,
      workers: workerStatus.workers,
      queues: queueStatus.queues,
      ingestion,
      metrics,
      traces,
      platform,
      apiKeys,
      vaultSecrets,
      vaultTokens,
      unavailableAreas,
      lastLoadedAt: new Date().toISOString(),
    });

    setIsLoading(false);
  }

  useEffect(() => {
    void loadDashboard();
  }, [selectedEnvironment, selectedProject?.id, selectedTimeRange]);

  useEffect(() => {
    const refreshInterval = window.setInterval(() => {
      void loadDashboard();
    }, 30_000);

    return () => window.clearInterval(refreshInterval);
  }, [selectedEnvironment, selectedProject?.id, selectedTimeRange]);

  useEffect(() => {
    if (dashboard.project === null) {
      return;
    }

    const projectId = dashboard.project.id;
    const socket = createPulseOpsSocket();

    if (socket === null) {
      return;
    }

    socket.on("connect", () => {
      setConnectionState("connected");
      void joinProjectRoom(socket, projectId, selectedEnvironment);
      void loadDashboard();
    });
    socket.on("disconnect", () => {
      setConnectionState("offline");
    });
    socket.on("connect_error", () => {
      setConnectionState("error");
    });
    socket.on("incident.updated", (message: RealtimeIncidentUpdate) => {
      setDashboard((current) => ({
        ...current,
        summary:
          current.summary === null
            ? current.summary
            : {
                ...current.summary,
                openIncidents:
                  message.incident.status === "open"
                    ? Math.max(current.summary.openIncidents, current.incidents.length + 1)
                    : current.summary.openIncidents,
              },
        incidents: upsertIncident(current.incidents, message.incident),
      }));
    });
    socket.on("event.created", (message: RealtimeEventCreated) => {
      setDashboard((current) => ({
        ...current,
        summary:
          current.summary === null
            ? current.summary
            : {
                ...current.summary,
                totalEvents: current.summary.totalEvents + 1,
              },
        events: upsertEvent(current.events, message.event).slice(0, 8),
      }));
    });
    socket.connect();

    return () => {
      leaveProjectRoom(socket, projectId, selectedEnvironment);
      socket.disconnect();
    };
  }, [dashboard.project, selectedEnvironment, selectedTimeRange]);

  const totalQueuedMessages = useMemo(
    () => dashboard.queues.reduce((total, queue) => total + (queue.messageCount ?? 0), 0),
    [dashboard.queues],
  );
  const blockedQueues = useMemo(
    () => dashboard.queues.filter((queue) => queue.health === "blocked").length,
    [dashboard.queues],
  );
  const activeApiKeys = useMemo(
    () => dashboard.apiKeys.filter((apiKey) => apiKey.status === "active").length,
    [dashboard.apiKeys],
  );
  const activeVaultTokens = useMemo(
    () => dashboard.vaultTokens.filter((token) => token.status === "active").length,
    [dashboard.vaultTokens],
  );
  const liveServices = useMemo(
    () => new Set(dashboard.events.map((event) => event.source)).size,
    [dashboard.events],
  );
  const healthyUpstreams = useMemo(
    () =>
      dashboard.platform?.services.filter((service) => service.status === "ok").length ??
      dashboard.workers.length,
    [dashboard.platform?.services, dashboard.workers.length],
  );
  const setupSteps = useMemo(
    () =>
      buildSetupSteps({
        activeApiKeys,
        activeVaultTokens,
        dashboard,
      }),
    [activeApiKeys, activeVaultTokens, dashboard],
  );
  const completedStepCount = setupSteps.filter((step) => step.isComplete).length;
  const readinessPercent = Math.round((completedStepCount / setupSteps.length) * 100);
  const modules = useMemo(
    () =>
      buildModules({
        activeApiKeys,
        activeVaultTokens,
        blockedQueues,
        dashboard,
        healthyUpstreams,
        liveServices,
        totalQueuedMessages,
      }),
    [
      activeApiKeys,
      activeVaultTokens,
      blockedQueues,
      dashboard,
      healthyUpstreams,
      liveServices,
      totalQueuedMessages,
    ],
  );
  const nextStep = nextAction(setupSteps);

  return (
    <main className="mx-auto flex max-w-7xl flex-col gap-5">
      <header className="flex flex-col gap-4 border-b border-slate-200 pb-4 xl:flex-row xl:items-end xl:justify-between">
        <div className="min-w-0">
          <p className="text-sm font-medium text-cyan-700">
            {dashboard.project?.name ?? "No project selected"} / {selectedEnvironment}
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-normal">PulseOps command center</h1>
          <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-slate-600">
            <StatusPill
              icon={RadioTower}
              label={connectionState}
              tone={connectionStateTone(connectionState)}
            />
            <StatusPill
              icon={ServerCog}
              label={dashboard.platform?.status ?? "platform unknown"}
              tone={dashboard.platform?.status === "ok" ? "good" : "muted"}
            />
            <StatusPill
              icon={Terminal}
              label={
                dashboard.lastLoadedAt === null
                  ? "not loaded"
                  : `updated ${formatRelativeTime(dashboard.lastLoadedAt)}`
              }
              tone="muted"
            />
          </div>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button asChild className="w-auto" variant="outline">
            <Link to="/dashboard/setup">
              <PlugZap className="h-4 w-4" />
              Connect app
            </Link>
          </Button>
          <Button asChild className="w-auto" variant="outline">
            <Link to="/dashboard/api-keys">
              <KeyRound className="h-4 w-4" />
              API keys
            </Link>
          </Button>
          <Button className="w-auto" onClick={() => void loadDashboard()} type="button">
            <RefreshCw className={cn("h-4 w-4", isLoading && "animate-spin")} />
            Refresh
          </Button>
        </div>
      </header>

      {dashboard.unavailableAreas.length > 0 ? (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Partial data loaded. Unavailable: {dashboard.unavailableAreas.join(", ")}.
        </div>
      ) : null}

      <section className="grid gap-4 xl:grid-cols-[1fr_24rem]">
        <div className="rounded-md border border-slate-200 bg-white p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-normal text-slate-500">
                Workspace readiness
              </p>
              <p className="mt-1 text-3xl font-semibold tabular-nums text-slate-950">
                {readinessPercent}%
              </p>
            </div>
            <div className="h-2 w-full rounded-full bg-slate-100 sm:w-72">
              <div
                className="h-2 rounded-full bg-cyan-600"
                style={{ width: `${readinessPercent}%` }}
              />
            </div>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {setupSteps.map((step) => (
              <Link
                className={cn(
                  "rounded-md border p-3 transition hover:bg-slate-50",
                  step.isComplete
                    ? "border-emerald-200 bg-emerald-50"
                    : "border-slate-200 bg-slate-50",
                )}
                key={step.label}
                to={step.href}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{step.label}</p>
                    <p className="mt-1 text-xs text-slate-600">{step.value}</p>
                  </div>
                  {step.isComplete ? (
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-700" />
                  ) : (
                    <Circle className="h-4 w-4 shrink-0 text-slate-400" />
                  )}
                </div>
              </Link>
            ))}
          </div>
        </div>

        <div className="rounded-md border border-slate-200 bg-slate-950 p-4 text-white">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold uppercase tracking-normal text-slate-400">
                Next action
              </p>
              <h2 className="mt-1 text-lg font-semibold">{nextStep.title}</h2>
            </div>
            <Workflow className="h-5 w-5 text-cyan-300" />
          </div>
          <p className="mt-3 text-sm leading-6 text-slate-300">{nextStep.detail}</p>
          <Button asChild className="mt-4 w-auto" variant="secondary">
            <Link to={nextStep.href}>
              Open
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>
      </section>

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
        <Metric
          href="/dashboard/logs"
          icon={Activity}
          label="Events"
          value={dashboard.summary?.totalEvents ?? 0}
        />
        <Metric
          href="/dashboard/alerts"
          icon={AlertTriangle}
          label="Incidents"
          tone="red"
          value={dashboard.summary?.openIncidents ?? 0}
        />
        <Metric
          href="/dashboard/metrics"
          icon={LineChart}
          label="Error rate"
          tone="amber"
          value={`${dashboard.metrics?.errorRate ?? 0}%`}
        />
        <Metric
          href="/dashboard/traces"
          icon={GitBranch}
          label="Slow traces"
          tone="blue"
          value={dashboard.traces?.slowTraces ?? 0}
        />
        <Metric
          href="/dashboard/workers"
          icon={Boxes}
          label="Queued"
          tone={blockedQueues > 0 ? "red" : "slate"}
          value={totalQueuedMessages}
        />
        <Metric
          href="/dashboard/vault"
          icon={LockKeyhole}
          label="Secrets"
          tone="violet"
          value={dashboard.vaultSecrets.length}
        />
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.4fr_1fr]">
        <Panel title="Product surfaces">
          <div className="grid gap-3 md:grid-cols-2">
            {modules.map((module) => (
              <ModuleCard key={module.href} module={module} />
            ))}
          </div>
        </Panel>

        <Panel title="Platform health">
          <div className="grid gap-3">
            <HealthRow label="Gateway" value={dashboard.platform?.status ?? "unknown"} />
            <HealthRow
              label="Upstreams"
              value={`${healthyUpstreams}/${dashboard.platform?.services.length ?? dashboard.workers.length}`}
            />
            <HealthRow label="Realtime" value={connectionState} />
            <HealthRow label="Workers" value={dashboard.workers.length} />
            <HealthRow
              label="Blocked queues"
              tone={blockedQueues > 0 ? "bad" : "good"}
              value={blockedQueues}
            />
          </div>
          <Button asChild className="mt-4" variant="outline">
            <Link to="/dashboard/platform">
              <ServerCog className="h-4 w-4" />
              Platform details
            </Link>
          </Button>
        </Panel>
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.25fr_1fr]">
        <Panel title="Recent events">
          {dashboard.events.length === 0 ? (
            <EmptyState
              actionHref="/dashboard/setup"
              actionLabel="Send test telemetry"
              icon={SearchCode}
              title={isLoading ? "Loading events" : "No telemetry yet"}
            />
          ) : (
            <div className="divide-y divide-slate-100">
              {dashboard.events.slice(0, 8).map((event) => (
                <Link
                  className="grid gap-2 py-3 transition hover:bg-slate-50 sm:grid-cols-[7rem_1fr_8rem]"
                  key={event.id}
                  to="/dashboard/logs"
                >
                  <span
                    className={cn(
                      "w-fit rounded-md border px-2 py-1 text-xs font-medium capitalize",
                      eventTone(event),
                    )}
                  >
                    {event.type}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-slate-900">
                      {event.message ?? event.name ?? event.fingerprint}
                    </p>
                    <p className="truncate text-xs text-slate-500">
                      {event.source} / {readAttribute(event.attributes, "environment") ?? "unknown"}
                    </p>
                  </div>
                  <span className="text-right text-xs text-slate-500">
                    {formatRelativeTime(event.receivedAt)}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </Panel>

        <Panel title="Active incidents">
          {dashboard.incidents.length === 0 ? (
            <EmptyState
              actionHref="/dashboard/alerts"
              actionLabel="Open incidents"
              icon={AlertTriangle}
              title={isLoading ? "Loading incidents" : "No open incidents"}
            />
          ) : (
            <div className="grid gap-3">
              {dashboard.incidents.slice(0, 6).map((incident) => (
                <Link
                  className="rounded-md border border-slate-200 bg-white p-3 transition hover:bg-slate-50"
                  key={incident.id}
                  to="/dashboard/alerts"
                >
                  <div className="flex items-start justify-between gap-3">
                    <h2 className="min-w-0 text-sm font-semibold text-slate-900">
                      {incident.title}
                    </h2>
                    <span
                      className={`shrink-0 rounded-md border px-2 py-1 text-xs font-medium ${severityClass(
                        incident.severity,
                      )}`}
                    >
                      {incident.severity}
                    </span>
                  </div>
                  <p className="mt-2 text-xs text-slate-500">
                    {incident.eventCount} events / {formatRelativeTime(incident.lastSeenAt)}
                  </p>
                </Link>
              ))}
            </div>
          )}
        </Panel>
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <Panel title="Throughput">
          {(dashboard.metrics?.buckets ?? []).length === 0 ? (
            <EmptyState
              actionHref="/dashboard/metrics"
              actionLabel="Open metrics"
              icon={LineChart}
              title="No metric buckets"
            />
          ) : (
            <div className="grid gap-2">
              {(dashboard.metrics?.buckets ?? []).slice(-12).map((bucket) => (
                <div
                  className="grid grid-cols-[5rem_1fr_5rem] items-center gap-3 text-sm"
                  key={bucket.startedAt}
                >
                  <span className="text-xs text-slate-500">{bucket.label}</span>
                  <div className="h-2 rounded-full bg-slate-100">
                    <div
                      className="h-2 rounded-full bg-cyan-600"
                      style={{
                        width: `${Math.max(4, Math.min(100, bucket.events * 8))}%`,
                      }}
                    />
                  </div>
                  <span className="text-right font-mono text-slate-700">{bucket.events}</span>
                </div>
              ))}
            </div>
          )}
        </Panel>

        <Panel title="Trace health">
          {(dashboard.traces?.traces ?? []).length === 0 ? (
            <EmptyState
              actionHref="/dashboard/traces"
              actionLabel="Open traces"
              icon={GitBranch}
              title="No trace groups"
            />
          ) : (
            <div className="grid gap-3">
              {(dashboard.traces?.traces ?? []).slice(0, 5).map((trace) => (
                <Link
                  className="rounded-md border border-slate-200 bg-white p-3 transition hover:bg-slate-50"
                  key={trace.traceId}
                  to="/dashboard/traces"
                >
                  <p className="truncate font-mono text-sm font-semibold text-slate-900">
                    {trace.traceId}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    {trace.rootService} / {trace.durationMs}ms / {trace.errorCount} errors
                  </p>
                </Link>
              ))}
            </div>
          )}
        </Panel>
      </section>
    </main>
  );
}

async function readOrDefault<T>(
  area: string,
  loader: () => Promise<T>,
  fallback: T,
  unavailableAreas: string[],
): Promise<T> {
  try {
    return await loader();
  } catch {
    unavailableAreas.push(area);
    return fallback;
  }
}

function emptySummary(projectId: string): DashboardSummary {
  return {
    openIncidents: 0,
    projectId,
    totalEvents: 0,
  };
}

function buildSetupSteps({
  activeApiKeys,
  activeVaultTokens,
  dashboard,
}: {
  readonly activeApiKeys: number;
  readonly activeVaultTokens: number;
  readonly dashboard: DashboardState;
}) {
  const acceptedEvents = dashboard.ingestion?.acceptedEvents ?? dashboard.summary?.totalEvents ?? 0;

  return [
    {
      href: "/dashboard/projects",
      isComplete: dashboard.project !== null,
      label: "Project",
      value: dashboard.project?.name ?? "Create workspace project",
    },
    {
      href: "/dashboard/api-keys",
      isComplete: activeApiKeys > 0,
      label: "Ingestion key",
      value: `${activeApiKeys} active`,
    },
    {
      href: "/dashboard/setup",
      isComplete: acceptedEvents > 0,
      label: "Telemetry",
      value: `${acceptedEvents} accepted`,
    },
    {
      href: "/dashboard/vault",
      isComplete: dashboard.vaultSecrets.length > 0,
      label: "Vault",
      value: `${dashboard.vaultSecrets.length} secrets`,
    },
    {
      href: "/dashboard/vault",
      isComplete: activeVaultTokens > 0,
      label: "Vault token",
      value: `${activeVaultTokens} active`,
    },
    {
      href: "/dashboard/platform",
      isComplete: dashboard.platform?.status === "ok" || dashboard.workers.length > 0,
      label: "Platform",
      value: dashboard.platform?.status ?? `${dashboard.workers.length} workers`,
    },
  ];
}

function buildModules({
  activeApiKeys,
  activeVaultTokens,
  blockedQueues,
  dashboard,
  healthyUpstreams,
  liveServices,
  totalQueuedMessages,
}: {
  readonly activeApiKeys: number;
  readonly activeVaultTokens: number;
  readonly blockedQueues: number;
  readonly dashboard: DashboardState;
  readonly healthyUpstreams: number;
  readonly liveServices: number;
  readonly totalQueuedMessages: number;
}) {
  return [
    {
      detail: `${dashboard.events.length} recent / ${liveServices} services`,
      href: "/dashboard/logs",
      icon: SearchCode,
      label: "Logs",
      tone: "cyan" as const,
    },
    {
      detail: `${dashboard.summary?.openIncidents ?? 0} open`,
      href: "/dashboard/alerts",
      icon: AlertTriangle,
      label: "Incidents",
      tone: (dashboard.summary?.openIncidents ?? 0) > 0 ? ("red" as const) : ("emerald" as const),
    },
    {
      detail: `${dashboard.metrics?.errorRate ?? 0}% error rate`,
      href: "/dashboard/metrics",
      icon: LineChart,
      label: "Metrics",
      tone: "blue" as const,
    },
    {
      detail: `${dashboard.traces?.totalTraces ?? 0} traces / ${dashboard.traces?.serviceCount ?? 0} services`,
      href: "/dashboard/traces",
      icon: GitBranch,
      label: "APM",
      tone: "violet" as const,
    },
    {
      detail: `${dashboard.workers.length} workers / ${totalQueuedMessages} queued`,
      href: "/dashboard/workers",
      icon: RadioTower,
      label: "Workers",
      tone: blockedQueues > 0 ? ("red" as const) : ("slate" as const),
    },
    {
      detail: `${dashboard.vaultSecrets.length} secrets / ${activeVaultTokens} tokens`,
      href: "/dashboard/vault",
      icon: LockKeyhole,
      label: "Vault",
      tone: "emerald" as const,
    },
    {
      detail: `${activeApiKeys} active ingestion keys`,
      href: "/dashboard/api-keys",
      icon: KeyRound,
      label: "API keys",
      tone: "amber" as const,
    },
    {
      detail: `${healthyUpstreams} healthy upstreams`,
      href: "/dashboard/platform",
      icon: ServerCog,
      label: "Platform",
      tone: "slate" as const,
    },
  ];
}

function nextAction(steps: ReturnType<typeof buildSetupSteps>): {
  readonly detail: string;
  readonly href: string;
  readonly title: string;
} {
  const incompleteStep = steps.find((step) => !step.isComplete);

  if (incompleteStep === undefined) {
    return {
      detail: "All core setup gates are complete for the selected project.",
      href: "/dashboard/logs",
      title: "Review live telemetry",
    };
  }

  return {
    detail: incompleteStep.value,
    href: incompleteStep.href,
    title: incompleteStep.label,
  };
}

function Metric({
  href,
  icon: Icon,
  label,
  tone = "cyan",
  value,
}: {
  readonly href: string;
  readonly icon: LucideIcon;
  readonly label: string;
  readonly tone?: Tone;
  readonly value: number | string;
}) {
  return (
    <Link
      className="rounded-md border border-slate-200 bg-white p-4 transition hover:border-cyan-300 hover:bg-slate-50"
      to={href}
    >
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium text-slate-500">{label}</p>
        <span className={cn("grid h-8 w-8 place-items-center rounded-md", toneSurface(tone))}>
          <Icon className="h-4 w-4" />
        </span>
      </div>
      <p className="mt-3 text-2xl font-semibold tabular-nums text-slate-950">{value}</p>
    </Link>
  );
}

function ModuleCard({
  module,
}: {
  readonly module: {
    readonly detail: string;
    readonly href: string;
    readonly icon: LucideIcon;
    readonly label: string;
    readonly tone: Tone;
  };
}) {
  const Icon = module.icon;

  return (
    <Link
      className="group rounded-md border border-slate-200 bg-white p-4 transition hover:border-cyan-300 hover:bg-slate-50"
      to={module.href}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <span
            className={cn(
              "grid h-9 w-9 shrink-0 place-items-center rounded-md",
              toneSurface(module.tone),
            )}
          >
            <Icon className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <h2 className="truncate text-sm font-semibold text-slate-950">{module.label}</h2>
            <p className="mt-1 truncate text-xs text-slate-500">{module.detail}</p>
          </div>
        </div>
        <ArrowRight className="h-4 w-4 shrink-0 text-slate-400 transition group-hover:translate-x-0.5 group-hover:text-slate-900" />
      </div>
    </Link>
  );
}

function Panel({ children, title }: { readonly children: ReactNode; readonly title: string }) {
  return (
    <section className="rounded-md border border-slate-200 bg-white p-4">
      <h2 className="text-sm font-semibold uppercase tracking-normal text-slate-500">{title}</h2>
      <div className="mt-3">{children}</div>
    </section>
  );
}

function EmptyState({
  actionHref,
  actionLabel,
  icon: Icon,
  title,
}: {
  readonly actionHref: string;
  readonly actionLabel: string;
  readonly icon: LucideIcon;
  readonly title: string;
}) {
  return (
    <div className="rounded-md border border-slate-200 bg-slate-50 p-4">
      <div className="flex items-center gap-3">
        <span className="grid h-9 w-9 place-items-center rounded-md bg-white text-slate-500">
          <Icon className="h-4 w-4" />
        </span>
        <p className="text-sm font-semibold text-slate-800">{title}</p>
      </div>
      <Button asChild className="mt-4 w-auto" variant="outline">
        <Link to={actionHref}>
          {actionLabel}
          <ArrowRight className="h-4 w-4" />
        </Link>
      </Button>
    </div>
  );
}

function HealthRow({
  label,
  tone = "neutral",
  value,
}: {
  readonly label: string;
  readonly tone?: "bad" | "good" | "neutral";
  readonly value: number | string;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
      <span className="text-sm text-slate-600">{label}</span>
      <span
        className={cn(
          "font-mono text-sm font-semibold",
          tone === "good" && "text-emerald-700",
          tone === "bad" && "text-red-700",
          tone === "neutral" && "text-slate-950",
        )}
      >
        {value}
      </span>
    </div>
  );
}

function StatusPill({
  icon: Icon,
  label,
  tone,
}: {
  readonly icon: LucideIcon;
  readonly label: string;
  readonly tone: "bad" | "good" | "muted" | "warn";
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm",
        tone === "good" && "border-emerald-200 bg-emerald-50 text-emerald-800",
        tone === "warn" && "border-amber-200 bg-amber-50 text-amber-800",
        tone === "bad" && "border-red-200 bg-red-50 text-red-800",
        tone === "muted" && "border-slate-200 bg-white text-slate-600",
      )}
    >
      <Icon className="h-4 w-4" />
      {label}
    </span>
  );
}

function connectionStateTone(connectionState: string): "bad" | "good" | "muted" | "warn" {
  if (connectionState === "connected") {
    return "good";
  }

  if (connectionState === "error") {
    return "bad";
  }

  if (connectionState === "offline") {
    return "warn";
  }

  return "muted";
}

function eventTone(event: DashboardEvent): string {
  if (event.type === "error" || event.level === "error") {
    return "border-red-200 bg-red-50 text-red-700";
  }

  if (event.level === "warn") {
    return "border-amber-200 bg-amber-50 text-amber-700";
  }

  if (event.type === "metric") {
    return "border-blue-200 bg-blue-50 text-blue-700";
  }

  return "border-emerald-200 bg-emerald-50 text-emerald-700";
}

type Tone = "amber" | "blue" | "cyan" | "emerald" | "red" | "slate" | "violet";

function toneSurface(tone: Tone): string {
  switch (tone) {
    case "amber":
      return "bg-amber-50 text-amber-700";
    case "blue":
      return "bg-blue-50 text-blue-700";
    case "cyan":
      return "bg-cyan-50 text-cyan-700";
    case "emerald":
      return "bg-emerald-50 text-emerald-700";
    case "red":
      return "bg-red-50 text-red-700";
    case "slate":
      return "bg-slate-100 text-slate-700";
    case "violet":
      return "bg-violet-50 text-violet-700";
  }
}

function readAttribute(attributes: Record<string, unknown>, key: string): string | null {
  const value = attributes[key];
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}

function upsertIncident(
  incidents: DashboardIncident[],
  incoming: DashboardIncident,
): DashboardIncident[] {
  const existingIndex = incidents.findIndex((incident) => incident.id === incoming.id);

  if (existingIndex === -1) {
    return [incoming, ...incidents];
  }

  return incidents.map((incident, index) => (index === existingIndex ? incoming : incident));
}

function upsertEvent(events: DashboardEvent[], incoming: DashboardEvent): DashboardEvent[] {
  const eventsById = new Map<string, DashboardEvent>();

  for (const event of [incoming, ...events]) {
    eventsById.set(event.id, event);
  }

  return [...eventsById.values()].sort(
    (left, right) => Date.parse(right.receivedAt) - Date.parse(left.receivedAt),
  );
}
