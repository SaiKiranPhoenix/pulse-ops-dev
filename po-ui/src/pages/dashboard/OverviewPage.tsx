import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  Activity,
  AlertTriangle,
  Boxes,
  GitBranch,
  LineChart,
  RefreshCw,
  RadioTower,
  type LucideIcon,
} from "lucide-react";
import { Link } from "react-router-dom";
import type { Project } from "@/features/auth/api";
import {
  getIngestionStats,
  getDashboardSummary,
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
import { Button } from "@/components/ui/button";
import { createPulseOpsSocket, joinProjectRoom, leaveProjectRoom } from "@/lib/socket-client";
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
  lastLoadedAt: null,
};

export function OverviewPage() {
  const { selectedEnvironment, selectedProject, selectedTimeRange } = useDashboardContext();
  const [dashboard, setDashboard] = useState<DashboardState>(emptyDashboard);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [connectionState, setConnectionState] = useState("offline");

  async function loadDashboard(): Promise<void> {
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const project = selectedProject;

      if (project === null) {
        setDashboard(emptyDashboard);
        return;
      }

      const [summary, events, incidents, workerStatus, queueStatus, ingestion, metrics, traces] =
        await Promise.all([
          getDashboardSummary(project.id),
          listDashboardEvents(project.id),
          listDashboardIncidents(project.id),
          getWorkerStatus(),
          getQueueStatus(),
          getIngestionStats(project.id, {
            environment: selectedEnvironment,
            timeRange: selectedTimeRange,
          }),
          getMetricSummary(project.id, {
            environment: selectedEnvironment,
            timeRange: selectedTimeRange,
          }),
          getTraceSummary(project.id, {
            environment: selectedEnvironment,
            timeRange: selectedTimeRange,
          }),
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
        lastLoadedAt: new Date().toISOString(),
      });
    } catch {
      setErrorMessage("Dashboard data is unavailable.");
    } finally {
      setIsLoading(false);
    }
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

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-5 text-slate-950 sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-7xl flex-col gap-5">
        <header className="flex flex-col gap-3 border-b border-slate-200 pb-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm font-medium text-cyan-700">
              {dashboard.project?.name ?? "No project selected"}
            </p>
            <h1 className="text-2xl font-semibold tracking-normal">Operations dashboard</h1>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600">
              <RadioTower className="h-4 w-4" />
              {connectionState}
            </span>
            <span className="inline-flex items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600">
              <LineChart className="h-4 w-4" />
              {dashboard.lastLoadedAt === null
                ? "not loaded"
                : `updated ${formatRelativeTime(dashboard.lastLoadedAt)}`}
            </span>
            <Button type="button" variant="outline" onClick={() => void loadDashboard()}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Refresh
            </Button>
          </div>
        </header>

        {errorMessage !== null ? (
          <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {errorMessage}
          </div>
        ) : null}

        <section className="grid gap-3 md:grid-cols-4">
          <Metric
            href="/dashboard/logs"
            label="Events"
            value={dashboard.summary?.totalEvents ?? 0}
            icon={Activity}
          />
          <Metric
            href="/dashboard/alerts"
            label="Open incidents"
            value={dashboard.summary?.openIncidents ?? 0}
            icon={AlertTriangle}
          />
          <Metric
            href="/dashboard/workers"
            label="Queued messages"
            value={totalQueuedMessages}
            icon={Boxes}
          />
          <Metric
            href="/dashboard/workers"
            label="Blocked queues"
            value={blockedQueues}
            icon={GitBranch}
          />
        </section>

        <section className="grid gap-3 md:grid-cols-4">
          <Metric
            href="/dashboard/metrics"
            label="Error rate"
            value={`${dashboard.metrics?.errorRate ?? 0}%`}
            icon={AlertTriangle}
          />
          <Metric
            href="/dashboard/metrics"
            label="P95 latency"
            value={
              dashboard.metrics?.p95LatencyMs === null ||
              dashboard.metrics?.p95LatencyMs === undefined
                ? "-"
                : `${dashboard.metrics.p95LatencyMs}ms`
            }
            icon={LineChart}
          />
          <Metric
            href="/dashboard/traces"
            label="Slow traces"
            value={dashboard.traces?.slowTraces ?? 0}
            icon={GitBranch}
          />
          <Metric
            href="/dashboard/setup"
            label="Backlog"
            value={dashboard.ingestion?.processingBacklog ?? 0}
            icon={Boxes}
          />
        </section>

        <section className="grid gap-4 xl:grid-cols-[1.3fr_1fr]">
          <Panel title="Recent Events" emptyText={isLoading ? "Loading events" : "No events yet"}>
            {dashboard.events.length === 0 ? (
              <p className="text-sm text-slate-500">
                {isLoading ? "Loading events" : "No events yet"}
              </p>
            ) : (
              <div className="divide-y divide-slate-100">
                {dashboard.events.slice(0, 8).map((event) => (
                  <div key={event.id} className="grid gap-2 py-3 sm:grid-cols-[7rem_1fr_8rem]">
                    <span className="text-sm font-medium capitalize text-slate-700">
                      {event.type}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-slate-900">
                        {event.message ?? event.name ?? event.fingerprint}
                      </p>
                      <p className="truncate text-xs text-slate-500">{event.source}</p>
                    </div>
                    <span className="text-right text-xs text-slate-500">
                      {formatRelativeTime(event.receivedAt)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </Panel>

          <Panel
            title="Active Incidents"
            emptyText={isLoading ? "Loading incidents" : "No incidents"}
          >
            <div className="flex flex-col gap-3">
              {dashboard.incidents.slice(0, 6).map((incident) => (
                <article
                  key={incident.id}
                  className="rounded-md border border-slate-200 bg-white p-3"
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
                    {incident.eventCount} events, last seen{" "}
                    {formatRelativeTime(incident.lastSeenAt)}
                  </p>
                </article>
              ))}
            </div>
          </Panel>
        </section>

        <section className="grid gap-4 xl:grid-cols-2">
          <Panel title="Workers" emptyText={isLoading ? "Loading workers" : "No active workers"}>
            <div className="divide-y divide-slate-100">
              {dashboard.workers.map((worker) => (
                <div key={worker.workerId} className="py-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold text-slate-900">{worker.workerId}</p>
                    <span className="rounded-md bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-700">
                      {worker.status}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-slate-500">
                    {worker.service} seen {worker.ageSeconds}s ago
                  </p>
                </div>
              ))}
            </div>
          </Panel>

          <Panel title="Queues" emptyText={isLoading ? "Loading queues" : "No queues observed"}>
            <div className="divide-y divide-slate-100">
              {dashboard.queues.map((queue) => (
                <div
                  key={queue.name}
                  className="grid grid-cols-[1fr_5rem_5rem] items-center gap-3 py-3 text-sm"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium text-slate-900">{queue.name}</p>
                    <p className="text-xs text-slate-500">{queue.status}</p>
                  </div>
                  <span className="text-right tabular-nums text-slate-700">
                    {queue.messageCount ?? "-"}
                  </span>
                  <span className="text-right tabular-nums text-slate-700">
                    {queue.consumerCount ?? "-"}
                  </span>
                </div>
              ))}
            </div>
          </Panel>
        </section>

        <section className="grid gap-4 xl:grid-cols-[1.2fr_1fr]">
          <Panel title="Throughput" emptyText="No metric buckets">
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
          </Panel>

          <Panel title="Trace Health" emptyText="No trace data">
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
          </Panel>
        </section>
      </div>
    </main>
  );
}

function Metric({
  href,
  label,
  value,
  icon: Icon,
}: {
  readonly href?: string;
  readonly label: string;
  readonly value: number | string;
  readonly icon: LucideIcon;
}) {
  const content = (
    <div className="rounded-md border border-slate-200 bg-white p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium text-slate-500">{label}</p>
        <Icon className="h-4 w-4 text-cyan-700" />
      </div>
      <p className="mt-3 text-2xl font-semibold tabular-nums">{value}</p>
    </div>
  );

  return href === undefined ? content : <Link to={href}>{content}</Link>;
}

function Panel({
  title,
  emptyText,
  children,
}: {
  readonly title: string;
  readonly emptyText: string;
  readonly children: ReactNode;
}) {
  return (
    <section className="rounded-md border border-slate-200 bg-white p-4">
      <h2 className="text-sm font-semibold uppercase tracking-normal text-slate-500">{title}</h2>
      <div className="mt-3">{children ?? <p className="text-sm">{emptyText}</p>}</div>
    </section>
  );
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
