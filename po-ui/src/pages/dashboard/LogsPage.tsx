import { AlertCircle, Clipboard, RefreshCw, Search, Send } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { listDashboardEvents, type DashboardEvent } from "@/features/dashboards/api";
import { getApiErrorMessage } from "@/lib/api-client";
import { formatRelativeTime } from "./dashboard-utils";
import { useDashboardContext } from "./DashboardLayout";

const eventTypes = ["all", "log", "error", "metric"] as const;
const levels = ["all", "debug", "info", "warn", "error"] as const;

type EventTypeFilter = (typeof eventTypes)[number];
type LevelFilter = (typeof levels)[number];

export function LogsPage() {
  const { selectedProject, selectedEnvironment } = useDashboardContext();
  const [events, setEvents] = useState<DashboardEvent[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<DashboardEvent | null>(null);
  const [typeFilter, setTypeFilter] = useState<EventTypeFilter>("all");
  const [levelFilter, setLevelFilter] = useState<LevelFilter>("all");
  const [search, setSearch] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function loadEvents(): Promise<void> {
    if (selectedProject === null) {
      setEvents([]);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      setEvents(await listDashboardEvents(selectedProject.id));
    } catch (requestError) {
      setError(getApiErrorMessage(requestError));
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadEvents();
  }, [selectedProject?.id]);

  const filteredEvents = useMemo(
    () =>
      events.filter((event) => {
        const searchable = [
          event.type,
          event.source,
          event.level,
          event.message,
          event.name,
          event.fingerprint,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

        return (
          (typeFilter === "all" || event.type === typeFilter) &&
          (levelFilter === "all" || event.level === levelFilter) &&
          (search.trim().length === 0 || searchable.includes(search.trim().toLowerCase()))
        );
      }),
    [events, levelFilter, search, typeFilter],
  );

  async function copyEvent(event: DashboardEvent): Promise<void> {
    await navigator.clipboard.writeText(JSON.stringify(event, null, 2));
    setMessage("Event copied to clipboard.");
  }

  return (
    <main className="mx-auto flex max-w-7xl flex-col gap-5">
      <header className="flex flex-col gap-3 border-b border-slate-200 pb-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-sm font-medium text-cyan-700">
            {selectedProject?.name ?? "No project selected"} / {selectedEnvironment}
          </p>
          <h1 className="text-2xl font-semibold tracking-normal">Live logs</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
            Inspect accepted logs, errors, and metrics while the realtime event stream is completed.
          </p>
        </div>
        <Button
          className="w-auto"
          onClick={() => void loadEvents()}
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

      {error !== null ? (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      <section className="grid gap-3 rounded-md border border-slate-200 bg-white p-4 lg:grid-cols-[1fr_10rem_10rem_auto]">
        <label className="relative block">
          <span className="sr-only">Search logs</span>
          <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-slate-400" />
          <Input
            className="pl-9"
            onChange={(event) => {
              setSearch(event.target.value);
            }}
            placeholder="Search source, message, fingerprint"
            value={search}
          />
        </label>

        <select
          className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm capitalize shadow-sm outline-none focus:ring-2 focus:ring-cyan-700"
          onChange={(event) => {
            setTypeFilter(event.target.value as EventTypeFilter);
          }}
          value={typeFilter}
        >
          {eventTypes.map((type) => (
            <option key={type} value={type}>
              {type}
            </option>
          ))}
        </select>

        <select
          className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm capitalize shadow-sm outline-none focus:ring-2 focus:ring-cyan-700"
          onChange={(event) => {
            setLevelFilter(event.target.value as LevelFilter);
          }}
          value={levelFilter}
        >
          {levels.map((level) => (
            <option key={level} value={level}>
              {level}
            </option>
          ))}
        </select>

        <Button asChild className="w-auto" variant="outline">
          <Link to="/dashboard/setup">
            <Send className="h-4 w-4" />
            Send test
          </Link>
        </Button>
      </section>

      <section className="grid gap-4 xl:grid-cols-[1fr_24rem]">
        <div className="rounded-md border border-slate-200 bg-white">
          <div className="grid grid-cols-[6rem_8rem_1fr_9rem] gap-3 border-b border-slate-100 px-4 py-3 text-xs font-semibold uppercase tracking-normal text-slate-500">
            <span>Type</span>
            <span>Source</span>
            <span>Message</span>
            <span className="text-right">Received</span>
          </div>

          {filteredEvents.length === 0 ? (
            <EmptyLogs isLoading={isLoading} />
          ) : (
            <div className="divide-y divide-slate-100">
              {filteredEvents.map((event) => (
                <button
                  className="grid w-full grid-cols-[6rem_8rem_1fr_9rem] items-center gap-3 px-4 py-3 text-left transition hover:bg-slate-50"
                  key={event.id}
                  onClick={() => {
                    setSelectedEvent(event);
                  }}
                  type="button"
                >
                  <span
                    className={`w-fit rounded-md border px-2 py-1 text-xs font-medium ${typeClass(event)}`}
                  >
                    {event.type}
                  </span>
                  <span className="truncate text-sm text-slate-600">{event.source}</span>
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium text-slate-900">
                      {event.message ?? event.name ?? event.fingerprint}
                    </span>
                    <span className="mt-1 block truncate font-mono text-xs text-slate-500">
                      {event.level ?? event.name ?? event.fingerprint}
                    </span>
                  </span>
                  <span className="text-right text-xs text-slate-500">
                    {formatRelativeTime(event.receivedAt)}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        <aside className="rounded-md border border-slate-200 bg-white p-4">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-sm font-semibold uppercase tracking-normal text-slate-500">
              Event detail
            </h2>
            {selectedEvent !== null ? (
              <Button
                className="h-8 w-8 px-0"
                onClick={() => void copyEvent(selectedEvent)}
                type="button"
                variant="outline"
              >
                <Clipboard className="h-4 w-4" />
              </Button>
            ) : null}
          </div>

          {selectedEvent === null ? (
            <p className="mt-6 text-sm text-slate-500">Select an event to inspect its fields.</p>
          ) : (
            <dl className="mt-4 grid gap-3 text-sm">
              <Detail label="ID" value={selectedEvent.id} mono />
              <Detail label="Type" value={selectedEvent.type} />
              <Detail label="Source" value={selectedEvent.source} />
              <Detail label="Level" value={selectedEvent.level ?? "-"} />
              <Detail label="Name" value={selectedEvent.name ?? "-"} />
              <Detail label="Message" value={selectedEvent.message ?? "-"} />
              <Detail
                label="Value"
                value={selectedEvent.value === null ? "-" : String(selectedEvent.value)}
              />
              <Detail label="Fingerprint" value={selectedEvent.fingerprint} mono />
              <Detail
                label="Observed"
                value={new Date(selectedEvent.observedAt).toLocaleString()}
              />
              <Detail
                label="Received"
                value={new Date(selectedEvent.receivedAt).toLocaleString()}
              />
            </dl>
          )}
        </aside>
      </section>
    </main>
  );
}

function EmptyLogs({ isLoading }: { readonly isLoading: boolean }) {
  return (
    <div className="flex items-start gap-3 px-4 py-8 text-sm text-slate-500">
      <AlertCircle className="mt-0.5 h-4 w-4 text-slate-400" />
      <div>
        <p className="font-medium text-slate-700">
          {isLoading ? "Loading events" : "No events yet"}
        </p>
        <p className="mt-1">
          Generate an API key from Setup, send test telemetry, then refresh this page.
        </p>
      </div>
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

function typeClass(event: DashboardEvent): string {
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
