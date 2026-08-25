import {
  AlertCircle,
  Braces,
  Clipboard,
  Pause,
  Play,
  RefreshCw,
  Search,
  Send,
  SlidersHorizontal,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  listDashboardEventPage,
  type DashboardEvent,
  type RealtimeEventCreated,
} from "@/features/dashboards/api";
import { getApiErrorMessage } from "@/lib/api-client";
import { createPulseOpsSocket, joinProjectRoom, leaveProjectRoom } from "@/lib/socket-client";
import { cn } from "@/lib/utils";
import { formatRelativeTime } from "./dashboard-utils";
import { dashboardEnvironments, useDashboardContext } from "./DashboardLayout";

const eventTypes = ["all", "log", "error", "metric"] as const;
const levels = ["all", "debug", "info", "warn", "error"] as const;
const eventPageSize = 50;
const timeRanges = [
  { label: "15m", value: "15m", minutes: 15 },
  { label: "1h", value: "1h", minutes: 60 },
  { label: "6h", value: "6h", minutes: 360 },
  { label: "24h", value: "24h", minutes: 1440 },
  { label: "All", value: "all", minutes: null },
] as const;

type EventTypeFilter = (typeof eventTypes)[number];
type LevelFilter = (typeof levels)[number];
type TimeRangeFilter = (typeof timeRanges)[number]["value"];

export function LogsPage() {
  const { selectedEnvironment, selectedProject } = useDashboardContext();
  const [events, setEvents] = useState<DashboardEvent[]>([]);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState<EventTypeFilter>("all");
  const [levelFilter, setLevelFilter] = useState<LevelFilter>("all");
  const [serviceFilter, setServiceFilter] = useState("all");
  const [environmentFilter, setEnvironmentFilter] = useState("all");
  const [timeRange, setTimeRange] = useState<TimeRangeFilter>("24h");
  const [search, setSearch] = useState("");
  const [isLive, setIsLive] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [lastLoadedAt, setLastLoadedAt] = useState<string | null>(null);
  const [connectionState, setConnectionState] = useState("offline");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function loadEvents(options: { readonly silent?: boolean } = {}): Promise<void> {
    if (selectedProject === null) {
      setEvents([]);
      setSelectedEventId(null);
      return;
    }

    if (!options.silent) {
      setIsLoading(true);
    }
    setError(null);

    try {
      const page = await listDashboardEventPage(selectedProject.id, { limit: eventPageSize });
      setEvents(page.events);
      setNextCursor(page.nextCursor);
      setLastLoadedAt(new Date().toISOString());
    } catch (requestError) {
      setError(getApiErrorMessage(requestError));
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadEvents();
  }, [selectedProject?.id]);

  useEffect(() => {
    if (!isLive || selectedProject === null) {
      setConnectionState("paused");
      return;
    }

    const projectId = selectedProject.id;
    const socket = createPulseOpsSocket();

    if (socket === null) {
      setConnectionState("unavailable");
      return;
    }

    socket.on("connect", () => {
      setConnectionState("connected");
      void joinProjectRoom(socket, projectId, selectedEnvironment);
      void loadEvents({ silent: true });
    });
    socket.on("disconnect", () => {
      setConnectionState("offline");
    });
    socket.on("connect_error", () => {
      setConnectionState("error");
    });
    socket.on("event.created", (update: RealtimeEventCreated) => {
      if (update.projectId !== projectId) {
        return;
      }

      setEvents((current) => upsertEvent(current, update.event));
      setLastLoadedAt(update.occurredAt);
    });
    socket.connect();

    return () => {
      leaveProjectRoom(socket, projectId, selectedEnvironment);
      socket.disconnect();
    };
  }, [isLive, selectedEnvironment, selectedProject?.id]);

  async function loadMoreEvents(): Promise<void> {
    if (selectedProject === null || nextCursor === null) {
      return;
    }

    setIsLoadingMore(true);
    setError(null);

    try {
      const page = await listDashboardEventPage(selectedProject.id, {
        cursor: nextCursor,
        limit: eventPageSize,
      });
      setEvents((current) => mergeEvents(current, page.events));
      setNextCursor(page.nextCursor);
    } catch (requestError) {
      setError(getApiErrorMessage(requestError));
    } finally {
      setIsLoadingMore(false);
    }
  }

  const services = useMemo(
    () =>
      [...new Set(events.map((event) => event.source))].sort((left, right) =>
        left.localeCompare(right),
      ),
    [events],
  );

  const filteredEvents = useMemo(
    () =>
      events.filter((event) => {
        const eventEnvironment = readAttribute(event.attributes, "environment") ?? "unknown";
        const searchable = [
          event.id,
          event.type,
          event.source,
          event.level,
          event.message,
          event.name,
          event.fingerprint,
          eventEnvironment,
          readAttribute(event.attributes, "traceId"),
          readAttribute(event.attributes, "requestId"),
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

        return (
          (typeFilter === "all" || event.type === typeFilter) &&
          (levelFilter === "all" || event.level === levelFilter) &&
          (serviceFilter === "all" || event.source === serviceFilter) &&
          (environmentFilter === "all" || eventEnvironment === environmentFilter) &&
          isInsideTimeRange(event.receivedAt, timeRange) &&
          (search.trim().length === 0 || searchable.includes(search.trim().toLowerCase()))
        );
      }),
    [environmentFilter, events, levelFilter, search, serviceFilter, timeRange, typeFilter],
  );

  useEffect(() => {
    setSelectedEventId((current) =>
      current !== null && filteredEvents.some((event) => event.id === current)
        ? current
        : (filteredEvents[0]?.id ?? null),
    );
  }, [filteredEvents]);

  const selectedEvent = useMemo(
    () => filteredEvents.find((event) => event.id === selectedEventId) ?? null,
    [filteredEvents, selectedEventId],
  );

  const summary = useMemo(
    () => ({
      errors: filteredEvents.filter((event) => event.type === "error" || event.level === "error")
        .length,
      events: filteredEvents.length,
      metrics: filteredEvents.filter((event) => event.type === "metric").length,
      services: new Set(filteredEvents.map((event) => event.source)).size,
    }),
    [filteredEvents],
  );

  async function copy(value: string, successMessage = "Copied to clipboard."): Promise<void> {
    await navigator.clipboard.writeText(value);
    setMessage(successMessage);
  }

  function resetFilters(): void {
    setTypeFilter("all");
    setLevelFilter("all");
    setServiceFilter("all");
    setEnvironmentFilter("all");
    setTimeRange("24h");
    setSearch("");
  }

  return (
    <main className="mx-auto flex max-w-7xl flex-col gap-5">
      <header className="flex flex-col gap-3 border-b border-slate-200 pb-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-sm font-medium text-cyan-700">
            {selectedProject?.name ?? "No project selected"} / {selectedEnvironment}
          </p>
          <h1 className="text-2xl font-semibold tracking-normal">Log event explorer</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
            Inspect logs, errors, and metrics from connected apps with filters, realtime updates,
            cursor paging, and redacted event details.
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button
            className="w-auto"
            onClick={() => setIsLive((current) => !current)}
            type="button"
            variant={isLive ? "primary" : "outline"}
          >
            {isLive ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
            {isLive ? "Pause live" : "Resume live"}
          </Button>
          <Button
            className="w-auto"
            onClick={() => void loadEvents()}
            type="button"
            variant="outline"
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </Button>
        </div>
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
        <Summary label="Visible events" value={summary.events} />
        <Summary label="Services" value={summary.services} />
        <Summary label="Errors" value={summary.errors} />
        <Summary label="Metrics" value={summary.metrics} />
      </section>

      <section className="grid gap-3 rounded-md border border-slate-200 bg-white p-4">
        <div className="grid gap-3 xl:grid-cols-[1fr_9rem_10rem_11rem_11rem_8rem_auto_auto]">
          <label className="relative block">
            <span className="sr-only">Search events</span>
            <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-slate-400" />
            <Input
              className="pl-9"
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search message, source, trace ID, request ID"
              value={search}
            />
          </label>

          <SelectFilter
            label="Type"
            onChange={(value) => setTypeFilter(value as EventTypeFilter)}
            options={eventTypes}
            value={typeFilter}
          />
          <SelectFilter
            label="Level"
            onChange={(value) => setLevelFilter(value as LevelFilter)}
            options={levels}
            value={levelFilter}
          />
          <SelectFilter
            label="Service"
            onChange={setServiceFilter}
            options={["all", ...services]}
            value={serviceFilter}
          />
          <SelectFilter
            label="Environment"
            onChange={setEnvironmentFilter}
            options={["all", ...dashboardEnvironments]}
            value={environmentFilter}
          />
          <SelectFilter
            label="Time"
            onChange={(value) => setTimeRange(value as TimeRangeFilter)}
            options={timeRanges.map((range) => range.value)}
            value={timeRange}
          />

          <Button className="w-auto" onClick={resetFilters} type="button" variant="outline">
            <X className="h-4 w-4" />
            Reset
          </Button>

          <Button asChild className="w-auto" variant="outline">
            <Link to="/dashboard/setup">
              <Send className="h-4 w-4" />
              Send test
            </Link>
          </Button>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
          <SlidersHorizontal className="h-3.5 w-3.5" />
          <span>{isLive ? `Realtime ${connectionState}` : "Realtime paused"}</span>
          <span>/</span>
          <span>
            {lastLoadedAt === null
              ? "Not loaded yet"
              : `Updated ${formatRelativeTime(lastLoadedAt)}`}
          </span>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[1fr_26rem]">
        <div className="overflow-x-auto rounded-md border border-slate-200 bg-white">
          <div className="grid min-w-[62rem] grid-cols-[6rem_8rem_9rem_1fr_11rem_9rem] gap-3 border-b border-slate-100 px-4 py-3 text-xs font-semibold uppercase tracking-normal text-slate-500">
            <span>Type</span>
            <span>Level</span>
            <span>Service</span>
            <span>Message</span>
            <span>Trace</span>
            <span className="text-right">Received</span>
          </div>

          <div className="min-w-[62rem]">
            {filteredEvents.length === 0 ? (
              <EmptyLogs isLoading={isLoading} />
            ) : (
              <div className="divide-y divide-slate-100">
                {filteredEvents.map((event) => (
                  <button
                    className={cn(
                      "grid w-full grid-cols-[6rem_8rem_9rem_1fr_11rem_9rem] items-center gap-3 px-4 py-3 text-left transition hover:bg-slate-50",
                      selectedEventId === event.id && "bg-cyan-50 hover:bg-cyan-50",
                    )}
                    key={event.id}
                    onClick={() => setSelectedEventId(event.id)}
                    type="button"
                  >
                    <span
                      className={cn(
                        "w-fit rounded-md border px-2 py-1 text-xs font-medium",
                        typeClass(event),
                      )}
                    >
                      {event.type}
                    </span>
                    <span className="text-sm capitalize text-slate-600">{event.level ?? "-"}</span>
                    <span className="truncate text-sm text-slate-600">{event.source}</span>
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium text-slate-900">
                        {event.message ?? event.name ?? event.fingerprint}
                      </span>
                      <span className="mt-1 block truncate font-mono text-xs text-slate-500">
                        {readAttribute(event.attributes, "environment") ?? "unknown"} /{" "}
                        {event.fingerprint}
                      </span>
                    </span>
                    <span className="truncate font-mono text-xs text-slate-500">
                      {readAttribute(event.attributes, "traceId") ?? "-"}
                    </span>
                    <span className="text-right text-xs text-slate-500">
                      {formatRelativeTime(event.receivedAt)}
                    </span>
                  </button>
                ))}
              </div>
            )}
            <div className="border-t border-slate-100 p-3">
              <Button
                disabled={nextCursor === null || isLoadingMore}
                onClick={() => void loadMoreEvents()}
                type="button"
                variant="outline"
              >
                {isLoadingMore ? "Loading older events" : "Load older events"}
              </Button>
            </div>
          </div>
        </div>

        <EventDetail event={selectedEvent} onCopy={copy} />
      </section>
    </main>
  );
}

function EventDetail({
  event,
  onCopy,
}: {
  readonly event: DashboardEvent | null;
  readonly onCopy: (value: string, successMessage?: string) => Promise<void>;
}) {
  const redactedJson = useMemo(
    () => (event === null ? "" : JSON.stringify(redactSensitiveValues(event), null, 2)),
    [event],
  );

  return (
    <aside className="rounded-md border border-slate-200 bg-white p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Braces className="h-4 w-4 text-cyan-700" />
          <h2 className="text-sm font-semibold uppercase tracking-normal text-slate-500">
            Event detail
          </h2>
        </div>
        {event !== null ? (
          <Button
            className="h-8 w-8 px-0"
            onClick={() => void onCopy(redactedJson, "Redacted event JSON copied.")}
            title="Copy redacted JSON"
            type="button"
            variant="outline"
          >
            <Clipboard className="h-4 w-4" />
          </Button>
        ) : null}
      </div>

      {event === null ? (
        <p className="mt-6 text-sm text-slate-500">Select an event to inspect its fields.</p>
      ) : (
        <div className="mt-4 grid gap-4">
          <dl className="grid gap-3 text-sm">
            <Detail copyValue={event.id} label="Event ID" onCopy={onCopy} value={event.id} mono />
            <Detail label="Type" value={event.type} />
            <Detail label="Source" value={event.source} />
            <Detail label="Level" value={event.level ?? "-"} />
            <Detail label="Name" value={event.name ?? "-"} />
            <Detail label="Message" value={event.message ?? "-"} />
            <Detail label="Value" value={event.value === null ? "-" : String(event.value)} />
            <Detail
              copyValue={event.fingerprint}
              label="Fingerprint"
              onCopy={onCopy}
              value={event.fingerprint}
              mono
            />
            <Detail
              copyValue={readAttribute(event.attributes, "requestId") ?? undefined}
              label="Request ID"
              onCopy={onCopy}
              value={readAttribute(event.attributes, "requestId") ?? "-"}
              mono
            />
            <Detail
              copyValue={readAttribute(event.attributes, "traceId") ?? undefined}
              label="Trace ID"
              onCopy={onCopy}
              value={readAttribute(event.attributes, "traceId") ?? "-"}
              mono
            />
            <Detail label="Observed" value={new Date(event.observedAt).toLocaleString()} />
            <Detail label="Received" value={new Date(event.receivedAt).toLocaleString()} />
          </dl>

          <section>
            <p className="text-xs font-semibold uppercase tracking-normal text-slate-500">
              Redacted JSON
            </p>
            <pre className="mt-2 max-h-[28rem] overflow-auto whitespace-pre-wrap break-words rounded-md bg-slate-950 p-3 text-xs leading-5 text-slate-100">
              {redactedJson}
            </pre>
          </section>
        </div>
      )}
    </aside>
  );
}

function EmptyLogs({ isLoading }: { readonly isLoading: boolean }) {
  return (
    <div className="flex min-w-[62rem] items-start gap-3 px-4 py-8 text-sm text-slate-500">
      <AlertCircle className="mt-0.5 h-4 w-4 text-slate-400" />
      <div>
        <p className="font-medium text-slate-700">
          {isLoading ? "Loading events" : "No events match the current filters"}
        </p>
        <p className="mt-1">
          Generate an API key, send test telemetry, or clear filters to broaden the event window.
        </p>
      </div>
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

function SelectFilter({
  label,
  onChange,
  options,
  value,
}: {
  readonly label: string;
  readonly onChange: (value: string) => void;
  readonly options: readonly string[];
  readonly value: string;
}) {
  return (
    <label className="block">
      <span className="sr-only">{label}</span>
      <select
        className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm capitalize shadow-sm outline-none focus:ring-2 focus:ring-cyan-700"
        onChange={(event) => onChange(event.target.value)}
        value={value}
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {formatFilterLabel(option)}
          </option>
        ))}
      </select>
    </label>
  );
}

function Detail({
  copyValue,
  label,
  mono = false,
  onCopy,
  value,
}: {
  readonly copyValue?: string;
  readonly label: string;
  readonly mono?: boolean;
  readonly onCopy?: (value: string, successMessage?: string) => Promise<void>;
  readonly value: string;
}) {
  return (
    <div>
      <dt className="flex items-center justify-between gap-3 text-xs font-semibold uppercase tracking-normal text-slate-500">
        {label}
        {copyValue !== undefined && onCopy !== undefined ? (
          <button
            className="text-slate-400 transition hover:text-slate-900"
            onClick={() => void onCopy(copyValue)}
            type="button"
          >
            <Clipboard className="h-3.5 w-3.5" />
          </button>
        ) : null}
      </dt>
      <dd className={cn("mt-1 break-words text-slate-900", mono && "font-mono text-xs")}>
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

function isInsideTimeRange(value: string, range: TimeRangeFilter): boolean {
  const selectedRange = timeRanges.find((candidate) => candidate.value === range);

  if (selectedRange?.minutes === null) {
    return true;
  }

  const minutes = selectedRange?.minutes ?? 1440;
  return Date.now() - Date.parse(value) <= minutes * 60 * 1_000;
}

function readAttribute(attributes: Record<string, unknown>, key: string): string | null {
  const value = attributes[key];
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}

function redactSensitiveValues(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(redactSensitiveValues);
  }

  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, nestedValue]) => [
        key,
        isSensitiveKey(key) ? "[redacted]" : redactSensitiveValues(nestedValue),
      ]),
    );
  }

  return value;
}

function isSensitiveKey(key: string): boolean {
  return /password|secret|token|api.?key|authorization|cookie|credential/i.test(key);
}

function formatFilterLabel(value: string): string {
  return value === "all" ? "All" : value;
}

function upsertEvent(events: DashboardEvent[], incoming: DashboardEvent): DashboardEvent[] {
  return mergeEvents([incoming], events);
}

function mergeEvents(current: DashboardEvent[], incoming: DashboardEvent[]): DashboardEvent[] {
  const eventsById = new Map<string, DashboardEvent>();

  for (const event of [...current, ...incoming]) {
    eventsById.set(event.id, event);
  }

  return [...eventsById.values()].sort(
    (left, right) => Date.parse(right.receivedAt) - Date.parse(left.receivedAt),
  );
}
