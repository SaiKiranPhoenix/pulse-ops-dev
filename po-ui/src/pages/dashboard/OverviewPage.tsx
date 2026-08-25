import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  Activity,
  AlertTriangle,
  Boxes,
  GitBranch,
  RefreshCw,
  RadioTower,
  type LucideIcon,
} from "lucide-react";
import { listProjects, type Project } from "@/features/auth/api";
import {
  getDashboardSummary,
  getQueueStatus,
  getWorkerStatus,
  listDashboardEvents,
  listDashboardIncidents,
  type DashboardEvent,
  type DashboardIncident,
  type DashboardSummary,
  type QueueStatus,
  type RealtimeEventCreated,
  type RealtimeIncidentUpdate,
  type WorkerHealth,
} from "@/features/dashboards/api";
import { Button } from "@/components/ui/button";
import { createPulseOpsSocket, joinProjectRoom, leaveProjectRoom } from "@/lib/socket-client";
import { chooseDefaultProject, formatRelativeTime, severityClass } from "./dashboard-utils";

type DashboardState = {
  readonly project: Project | null;
  readonly summary: DashboardSummary | null;
  readonly events: DashboardEvent[];
  readonly incidents: DashboardIncident[];
  readonly workers: WorkerHealth[];
  readonly queues: QueueStatus[];
};

const emptyDashboard: DashboardState = {
  project: null,
  summary: null,
  events: [],
  incidents: [],
  workers: [],
  queues: [],
};

export function OverviewPage() {
  const [dashboard, setDashboard] = useState<DashboardState>(emptyDashboard);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [connectionState, setConnectionState] = useState("offline");

  async function loadDashboard(): Promise<void> {
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const projects = await listProjects();
      const project = chooseDefaultProject(projects);

      if (project === null) {
        setDashboard(emptyDashboard);
        return;
      }

      const [summary, events, incidents, workerStatus, queueStatus] = await Promise.all([
        getDashboardSummary(project.id),
        listDashboardEvents(project.id),
        listDashboardIncidents(project.id),
        getWorkerStatus(),
        getQueueStatus(),
      ]);

      setDashboard({
        project,
        summary,
        events,
        incidents,
        workers: workerStatus.workers,
        queues: queueStatus.queues,
      });
    } catch {
      setErrorMessage("Dashboard data is unavailable.");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadDashboard();
  }, []);

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
      void joinProjectRoom(socket, projectId);
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
      leaveProjectRoom(socket, projectId);
      socket.disconnect();
    };
  }, [dashboard.project]);

  const totalQueuedMessages = useMemo(
    () => dashboard.queues.reduce((total, queue) => total + (queue.messageCount ?? 0), 0),
    [dashboard.queues],
  );
  const activeConsumers = useMemo(
    () => dashboard.queues.reduce((total, queue) => total + (queue.consumerCount ?? 0), 0),
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
          <Metric label="Events" value={dashboard.summary?.totalEvents ?? 0} icon={Activity} />
          <Metric
            label="Open incidents"
            value={dashboard.summary?.openIncidents ?? 0}
            icon={AlertTriangle}
          />
          <Metric label="Queued messages" value={totalQueuedMessages} icon={Boxes} />
          <Metric label="Consumers" value={activeConsumers} icon={GitBranch} />
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
      </div>
    </main>
  );
}

function Metric({
  label,
  value,
  icon: Icon,
}: {
  readonly label: string;
  readonly value: number;
  readonly icon: LucideIcon;
}) {
  return (
    <div className="rounded-md border border-slate-200 bg-white p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium text-slate-500">{label}</p>
        <Icon className="h-4 w-4 text-cyan-700" />
      </div>
      <p className="mt-3 text-2xl font-semibold tabular-nums">{value}</p>
    </div>
  );
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
