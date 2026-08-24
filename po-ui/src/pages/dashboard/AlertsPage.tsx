import { AlertTriangle, CheckCircle2, Clipboard, RefreshCw, RotateCcw, Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  getIncident,
  listIncidents,
  reopenIncident,
  resolveIncident,
  type Incident,
} from "@/features/alerts/api";
import type { RealtimeIncidentUpdate } from "@/features/dashboards/api";
import { getApiErrorMessage } from "@/lib/api-client";
import { createPulseOpsSocket, joinProjectRoom, leaveProjectRoom } from "@/lib/socket-client";
import { formatRelativeTime, severityClass } from "./dashboard-utils";
import { useDashboardContext } from "./DashboardLayout";

const statuses = ["all", "open", "resolved"] as const;
const severities = ["all", "critical", "high", "medium", "low"] as const;

type StatusFilter = (typeof statuses)[number];
type SeverityFilter = (typeof severities)[number];

export function AlertsPage() {
  const { selectedEnvironment, selectedProject } = useDashboardContext();
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [selectedIncident, setSelectedIncident] = useState<Incident | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [severityFilter, setSeverityFilter] = useState<SeverityFilter>("all");
  const [search, setSearch] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function loadIncidents(): Promise<void> {
    if (selectedProject === null) {
      setIncidents([]);
      setSelectedIncident(null);
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    try {
      const nextIncidents = await listIncidents(
        selectedProject.id,
        statusFilter === "all" ? undefined : statusFilter,
      );
      setIncidents(nextIncidents);
      setSelectedIncident((current) =>
        current === null
          ? (nextIncidents[0] ?? null)
          : (nextIncidents.find((incident) => incident.id === current.id) ??
            nextIncidents[0] ??
            null),
      );
    } catch (requestError) {
      setErrorMessage(getApiErrorMessage(requestError));
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadIncidents();
  }, [selectedProject?.id, statusFilter]);

  useEffect(() => {
    if (selectedProject === null) {
      return;
    }

    const socket = createPulseOpsSocket();

    if (socket === null) {
      return;
    }

    socket.on("connect", () => {
      void joinProjectRoom(socket, selectedProject.id);
    });
    socket.on("incident.updated", (update: RealtimeIncidentUpdate) => {
      setIncidents((current) => upsertIncident(current, update.incident as Incident));
      setSelectedIncident((current) =>
        current?.id === update.incident.id ? (update.incident as Incident) : current,
      );
    });
    socket.connect();

    return () => {
      leaveProjectRoom(socket, selectedProject.id);
      socket.disconnect();
    };
  }, [selectedProject]);

  const filteredIncidents = useMemo(
    () =>
      incidents.filter((incident) => {
        const searchable = [
          incident.title,
          incident.summary,
          incident.fingerprint,
          incident.severity,
          incident.status,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

        return (
          (severityFilter === "all" || incident.severity === severityFilter) &&
          (search.trim().length === 0 || searchable.includes(search.trim().toLowerCase()))
        );
      }),
    [incidents, search, severityFilter],
  );

  const summary = useMemo(
    () => ({
      open: incidents.filter((incident) => incident.status === "open").length,
      resolved: incidents.filter((incident) => incident.status === "resolved").length,
      critical: incidents.filter((incident) => incident.severity === "critical").length,
      events: incidents.reduce((total, incident) => total + incident.eventCount, 0),
    }),
    [incidents],
  );

  async function selectIncident(incident: Incident): Promise<void> {
    if (selectedProject === null) {
      return;
    }

    setSelectedIncident(incident);
    setErrorMessage(null);

    try {
      setSelectedIncident(await getIncident(selectedProject.id, incident.id));
    } catch (requestError) {
      setErrorMessage(getApiErrorMessage(requestError));
    }
  }

  async function updateIncidentStatus(incident: Incident): Promise<void> {
    if (selectedProject === null) {
      return;
    }

    setErrorMessage(null);
    setMessage(null);

    try {
      const updatedIncident =
        incident.status === "open"
          ? await resolveIncident(selectedProject.id, incident.id)
          : await reopenIncident(selectedProject.id, incident.id);
      setIncidents((current) => upsertIncident(current, updatedIncident));
      setSelectedIncident(updatedIncident);
      setMessage(
        updatedIncident.status === "resolved" ? "Incident resolved." : "Incident reopened.",
      );
    } catch (requestError) {
      setErrorMessage(getApiErrorMessage(requestError));
    }
  }

  async function copySummary(incident: Incident): Promise<void> {
    await navigator.clipboard.writeText(toIncidentSummary(incident));
    setMessage("Incident summary copied.");
  }

  return (
    <main className="mx-auto flex max-w-7xl flex-col gap-5">
      <header className="flex flex-col gap-3 border-b border-slate-200 pb-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-sm font-medium text-cyan-700">
            {selectedProject?.name ?? "No project selected"} / {selectedEnvironment}
          </p>
          <h1 className="text-2xl font-semibold tracking-normal">Incident workbench</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
            Triage incident state, severity, event volume, and rule context from one operational
            surface.
          </p>
        </div>
        <Button
          className="w-auto"
          onClick={() => void loadIncidents()}
          type="button"
          variant="outline"
        >
          <RefreshCw className="h-4 w-4" />
          Refresh
        </Button>
      </header>

      {message !== null ? (
        <div className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {message}
        </div>
      ) : null}

      {errorMessage !== null ? (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {errorMessage}
        </div>
      ) : null}

      <section className="grid gap-3 md:grid-cols-4">
        <Summary label="Open" value={summary.open} />
        <Summary label="Resolved" value={summary.resolved} />
        <Summary label="Critical" value={summary.critical} />
        <Summary label="Linked events" value={summary.events} />
      </section>

      <section className="grid gap-3 rounded-md border border-slate-200 bg-white p-4 lg:grid-cols-[1fr_10rem_10rem]">
        <label className="relative block">
          <span className="sr-only">Search incidents</span>
          <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-slate-400" />
          <Input
            className="pl-9"
            onChange={(event) => {
              setSearch(event.target.value);
            }}
            placeholder="Search title, fingerprint, summary"
            value={search}
          />
        </label>

        <select
          className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm capitalize shadow-sm outline-none focus:ring-2 focus:ring-cyan-700"
          onChange={(event) => {
            setStatusFilter(event.target.value as StatusFilter);
          }}
          value={statusFilter}
        >
          {statuses.map((status) => (
            <option key={status} value={status}>
              {status}
            </option>
          ))}
        </select>

        <select
          className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm capitalize shadow-sm outline-none focus:ring-2 focus:ring-cyan-700"
          onChange={(event) => {
            setSeverityFilter(event.target.value as SeverityFilter);
          }}
          value={severityFilter}
        >
          {severities.map((severity) => (
            <option key={severity} value={severity}>
              {severity}
            </option>
          ))}
        </select>
      </section>

      <section className="grid gap-4 xl:grid-cols-[1fr_28rem]">
        <div className="rounded-md border border-slate-200 bg-white">
          <div className="grid grid-cols-[1fr_7rem_8rem_7rem] gap-3 border-b border-slate-100 px-4 py-3 text-xs font-semibold uppercase tracking-normal text-slate-500">
            <span>Incident</span>
            <span>Severity</span>
            <span>Status</span>
            <span className="text-right">Events</span>
          </div>
          {filteredIncidents.length === 0 ? (
            <p className="px-4 py-6 text-sm text-slate-500">
              {isLoading ? "Loading incidents" : "No incidents match the current filters"}
            </p>
          ) : (
            <div className="divide-y divide-slate-100">
              {filteredIncidents.map((incident) => (
                <button
                  className="grid w-full grid-cols-[1fr_7rem_8rem_7rem] items-center gap-3 px-4 py-3 text-left transition hover:bg-slate-50"
                  key={incident.id}
                  onClick={() => void selectIncident(incident)}
                  type="button"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600" />
                      <h2 className="truncate text-sm font-semibold text-slate-900">
                        {incident.title}
                      </h2>
                    </div>
                    <p className="mt-1 truncate font-mono text-xs text-slate-500">
                      {incident.fingerprint}
                    </p>
                  </div>
                  <span
                    className={`w-fit rounded-md border px-2 py-1 text-xs font-medium ${severityClass(
                      incident.severity,
                    )}`}
                  >
                    {incident.severity}
                  </span>
                  <span
                    className={incident.status === "open" ? openStatusClass : resolvedStatusClass}
                  >
                    {incident.status}
                  </span>
                  <span className="text-right font-mono text-sm text-slate-700">
                    {incident.eventCount}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        <aside className="rounded-md border border-slate-200 bg-white p-4">
          {selectedIncident === null ? (
            <p className="text-sm text-slate-500">Select an incident to open the triage panel.</p>
          ) : (
            <IncidentDetail
              incident={selectedIncident}
              onCopy={() => void copySummary(selectedIncident)}
              onToggleStatus={() => void updateIncidentStatus(selectedIncident)}
            />
          )}
        </aside>
      </section>
    </main>
  );
}

function IncidentDetail({
  incident,
  onCopy,
  onToggleStatus,
}: {
  readonly incident: Incident;
  readonly onCopy: () => void;
  readonly onToggleStatus: () => void;
}) {
  return (
    <div className="grid gap-5">
      <div>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-normal text-slate-500">
              Triage detail
            </p>
            <h2 className="mt-2 text-lg font-semibold leading-6 text-slate-950">
              {incident.title}
            </h2>
          </div>
          <span
            className={`shrink-0 rounded-md border px-2 py-1 text-xs font-medium ${severityClass(
              incident.severity,
            )}`}
          >
            {incident.severity}
          </span>
        </div>
        {incident.summary !== null ? (
          <p className="mt-3 text-sm leading-6 text-slate-600">{incident.summary}</p>
        ) : null}
      </div>

      <div className="flex flex-col gap-2 sm:flex-row">
        <Button className="w-full" onClick={onToggleStatus} type="button" variant="primary">
          {incident.status === "open" ? (
            <CheckCircle2 className="h-4 w-4" />
          ) : (
            <RotateCcw className="h-4 w-4" />
          )}
          {incident.status === "open" ? "Resolve incident" : "Reopen incident"}
        </Button>
        <Button className="w-full" onClick={onCopy} type="button" variant="outline">
          <Clipboard className="h-4 w-4" />
          Copy summary
        </Button>
      </div>

      <dl className="grid gap-3 rounded-md border border-slate-200 bg-slate-50 p-3 text-sm">
        <Detail label="Status" value={incident.status} />
        <Detail label="Events" value={String(incident.eventCount)} />
        <Detail label="Fingerprint" value={incident.fingerprint} mono />
        <Detail label="First seen" value={new Date(incident.firstSeenAt).toLocaleString()} />
        <Detail label="Last seen" value={new Date(incident.lastSeenAt).toLocaleString()} />
        <Detail
          label="Resolved"
          value={
            incident.resolvedAt === null ? "-" : new Date(incident.resolvedAt).toLocaleString()
          }
        />
      </dl>

      <section>
        <h3 className="text-sm font-semibold uppercase tracking-normal text-slate-500">Timeline</h3>
        <div className="mt-3 grid gap-3">
          <TimelineItem label="Opened" value={incident.firstSeenAt} />
          <TimelineItem label="Last matched" value={incident.lastSeenAt} />
          {incident.resolvedAt !== null ? (
            <TimelineItem label="Resolved" value={incident.resolvedAt} />
          ) : null}
        </div>
      </section>

      <section>
        <h3 className="text-sm font-semibold uppercase tracking-normal text-slate-500">
          Rule context
        </h3>
        <p className="mt-2 rounded-md border border-slate-200 bg-slate-50 p-3 text-sm leading-6 text-slate-600">
          This incident was created from repeated error telemetry with the same fingerprint. The
          current backend deduplicates open incidents by project and fingerprint.
        </p>
      </section>
    </div>
  );
}

function Summary({ label, value }: { readonly label: string; readonly value: number }) {
  return (
    <div className="rounded-md border border-slate-200 bg-white p-4">
      <p className="text-sm font-medium text-slate-500">{label}</p>
      <p className="mt-3 text-2xl font-semibold tabular-nums">{value}</p>
    </div>
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
      <dd className={`mt-1 break-words text-slate-900 ${mono ? "font-mono text-xs" : ""}`}>
        {value}
      </dd>
    </div>
  );
}

function TimelineItem({ label, value }: { readonly label: string; readonly value: string }) {
  return (
    <div className="flex gap-3">
      <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-cyan-700" />
      <div>
        <p className="text-sm font-medium text-slate-900">{label}</p>
        <p className="text-xs text-slate-500">
          {new Date(value).toLocaleString()} ({formatRelativeTime(value)})
        </p>
      </div>
    </div>
  );
}

function upsertIncident(incidents: Incident[], incoming: Incident): Incident[] {
  const existingIndex = incidents.findIndex((incident) => incident.id === incoming.id);

  if (existingIndex === -1) {
    return [incoming, ...incidents];
  }

  return incidents.map((incident, index) => (index === existingIndex ? incoming : incident));
}

function toIncidentSummary(incident: Incident): string {
  return [
    `Incident: ${incident.title}`,
    `Status: ${incident.status}`,
    `Severity: ${incident.severity}`,
    `Events: ${incident.eventCount}`,
    `Fingerprint: ${incident.fingerprint}`,
    `First seen: ${incident.firstSeenAt}`,
    `Last seen: ${incident.lastSeenAt}`,
    incident.summary === null ? "" : `Summary: ${incident.summary}`,
  ]
    .filter((line) => line.length > 0)
    .join("\n");
}

const openStatusClass =
  "w-fit rounded-md border border-red-200 bg-red-50 px-2 py-1 text-xs font-medium capitalize text-red-700";

const resolvedStatusClass =
  "w-fit rounded-md border border-emerald-200 bg-emerald-50 px-2 py-1 text-xs font-medium capitalize text-emerald-700";
