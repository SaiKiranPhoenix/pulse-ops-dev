import { useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, RefreshCw, RotateCcw } from "lucide-react";
import { listProjects, type Project } from "@/features/auth/api";
import {
  listIncidents,
  reopenIncident,
  resolveIncident,
  type Incident,
} from "@/features/alerts/api";
import type { RealtimeIncidentUpdate } from "@/features/dashboards/api";
import { Button } from "@/components/ui/button";
import { createPulseOpsSocket, joinProjectRoom, leaveProjectRoom } from "@/lib/socket-client";
import { chooseDefaultProject, formatRelativeTime, severityClass } from "./dashboard-utils";

export function AlertsPage() {
  const [project, setProject] = useState<Project | null>(null);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function loadIncidents(): Promise<void> {
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const projects = await listProjects();
      const selectedProject = chooseDefaultProject(projects);
      setProject(selectedProject);

      if (selectedProject === null) {
        setIncidents([]);
        return;
      }

      setIncidents(await listIncidents(selectedProject.id));
    } catch {
      setErrorMessage("Incidents are unavailable.");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadIncidents();
  }, []);

  useEffect(() => {
    if (project === null) {
      return;
    }

    const socket = createPulseOpsSocket();

    if (socket === null) {
      return;
    }

    socket.on("connect", () => {
      void joinProjectRoom(socket, project.id);
    });
    socket.on("incident.updated", (message: RealtimeIncidentUpdate) => {
      setIncidents((current) => upsertIncident(current, message.incident as Incident));
    });
    socket.connect();

    return () => {
      leaveProjectRoom(socket, project.id);
      socket.disconnect();
    };
  }, [project]);

  async function updateIncidentStatus(incident: Incident): Promise<void> {
    if (project === null) {
      return;
    }

    const updatedIncident =
      incident.status === "open"
        ? await resolveIncident(project.id, incident.id)
        : await reopenIncident(project.id, incident.id);
    setIncidents((current) => upsertIncident(current, updatedIncident));
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-5 text-slate-950 sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-7xl flex-col gap-5">
        <header className="flex flex-col gap-3 border-b border-slate-200 pb-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm font-medium text-cyan-700">
              {project?.name ?? "No project selected"}
            </p>
            <h1 className="text-2xl font-semibold tracking-normal">Incident workbench</h1>
          </div>
          <Button type="button" variant="outline" onClick={() => void loadIncidents()}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
        </header>

        {errorMessage !== null ? (
          <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {errorMessage}
          </div>
        ) : null}

        <section className="grid gap-3 md:grid-cols-3">
          <Summary label="Open" value={incidents.filter((item) => item.status === "open").length} />
          <Summary
            label="Resolved"
            value={incidents.filter((item) => item.status === "resolved").length}
          />
          <Summary
            label="Total event count"
            value={incidents.reduce((total, item) => total + item.eventCount, 0)}
          />
        </section>

        <section className="rounded-md border border-slate-200 bg-white">
          <div className="grid grid-cols-[1fr_7rem_8rem_8rem] gap-3 border-b border-slate-100 px-4 py-3 text-xs font-semibold uppercase tracking-normal text-slate-500">
            <span>Incident</span>
            <span>Severity</span>
            <span>Status</span>
            <span className="text-right">Action</span>
          </div>
          {incidents.length === 0 ? (
            <p className="px-4 py-6 text-sm text-slate-500">
              {isLoading ? "Loading incidents" : "No incidents yet"}
            </p>
          ) : (
            <div className="divide-y divide-slate-100">
              {incidents.map((incident) => (
                <article
                  key={incident.id}
                  className="grid grid-cols-[1fr_7rem_8rem_8rem] items-center gap-3 px-4 py-3"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600" />
                      <h2 className="truncate text-sm font-semibold text-slate-900">
                        {incident.title}
                      </h2>
                    </div>
                    <p className="mt-1 truncate text-xs text-slate-500">
                      {incident.fingerprint} - {incident.eventCount} events -{" "}
                      {formatRelativeTime(incident.lastSeenAt)}
                    </p>
                  </div>
                  <span
                    className={`w-fit rounded-md border px-2 py-1 text-xs font-medium ${severityClass(
                      incident.severity,
                    )}`}
                  >
                    {incident.severity}
                  </span>
                  <span className="text-sm capitalize text-slate-600">{incident.status}</span>
                  <div className="flex justify-end">
                    <Button
                      type="button"
                      variant="outline"
                      className="h-9 w-9 px-0"
                      onClick={() => void updateIncidentStatus(incident)}
                    >
                      {incident.status === "open" ? (
                        <CheckCircle2 className="h-4 w-4" />
                      ) : (
                        <RotateCcw className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
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

function upsertIncident(incidents: Incident[], incoming: Incident): Incident[] {
  const existingIndex = incidents.findIndex((incident) => incident.id === incoming.id);

  if (existingIndex === -1) {
    return [incoming, ...incidents];
  }

  return incidents.map((incident, index) => (index === existingIndex ? incoming : incident));
}
