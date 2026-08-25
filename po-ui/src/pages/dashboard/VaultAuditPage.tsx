import { Clipboard, RefreshCw, Search, ShieldCheck } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  listVaultAuditEvents,
  type VaultAuditEvent,
  type VaultAuditFilters,
} from "@/features/vault/api";
import { getApiErrorMessage } from "@/lib/api-client";
import {
  createPulseOpsSocket,
  joinProjectRoom,
  leaveProjectRoom,
  type RealtimeVaultAuditCreated,
} from "@/lib/socket-client";
import { formatRelativeTime } from "./dashboard-utils";
import { dashboardEnvironments, useDashboardContext } from "./DashboardLayout";

const results = ["all", "success", "failure"] as const;
const actorTypes = ["all", "user", "integration", "service"] as const;
const auditTimeRanges = ["1h", "6h", "24h", "7d", "all"] as const;

type ResultFilter = (typeof results)[number];
type ActorTypeFilter = (typeof actorTypes)[number];
type AuditTimeRange = (typeof auditTimeRanges)[number];

export function VaultAuditPage() {
  const { selectedEnvironment, selectedProject } = useDashboardContext();
  const [events, setEvents] = useState<VaultAuditEvent[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<VaultAuditEvent | null>(null);
  const [resultFilter, setResultFilter] = useState<ResultFilter>("all");
  const [actorTypeFilter, setActorTypeFilter] = useState<ActorTypeFilter>("all");
  const [environmentFilter, setEnvironmentFilter] = useState<string>(selectedEnvironment);
  const [actionFilter, setActionFilter] = useState("");
  const [secretKeyFilter, setSecretKeyFilter] = useState("");
  const [actorFilter, setActorFilter] = useState("");
  const [timeRange, setTimeRange] = useState<AuditTimeRange>("24h");
  const [search, setSearch] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function loadAudit(): Promise<void> {
    if (selectedProject === null) {
      setEvents([]);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const nextEvents = await listVaultAuditEvents(
        selectedProject.id,
        buildAuditFilters({
          actionFilter,
          actorFilter,
          environmentFilter,
          resultFilter,
          secretKeyFilter,
          timeRange,
        }),
      );
      setEvents(nextEvents);
      setSelectedEvent((current) =>
        current === null
          ? (nextEvents[0] ?? null)
          : (nextEvents.find((event) => event.id === current.id) ?? nextEvents[0] ?? null),
      );
    } catch (requestError) {
      setError(getApiErrorMessage(requestError));
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadAudit();
  }, [
    actionFilter,
    actorFilter,
    environmentFilter,
    resultFilter,
    secretKeyFilter,
    selectedProject?.id,
    timeRange,
  ]);

  useEffect(() => {
    setEnvironmentFilter(selectedEnvironment);
  }, [selectedEnvironment]);

  useEffect(() => {
    if (selectedProject === null) {
      return;
    }

    const socket = createPulseOpsSocket();

    if (socket === null) {
      return;
    }

    socket.on("connect", () => {
      void joinProjectRoom(socket, selectedProject.id, selectedEnvironment);
    });
    socket.on("vault.audit.created", (update: RealtimeVaultAuditCreated) => {
      const filters = buildAuditFilters({
        actionFilter,
        actorFilter,
        environmentFilter,
        resultFilter,
        secretKeyFilter,
        timeRange,
      });

      if (!auditEventMatchesFilters(update.auditEvent, filters, actorTypeFilter, search)) {
        return;
      }

      setEvents((current) => upsertAuditEvent(current, update.auditEvent).slice(0, 100));
      setSelectedEvent((current) => current ?? update.auditEvent);
    });
    socket.connect();

    return () => {
      leaveProjectRoom(socket, selectedProject.id, selectedEnvironment);
      socket.disconnect();
    };
  }, [
    actionFilter,
    actorFilter,
    actorTypeFilter,
    environmentFilter,
    resultFilter,
    search,
    secretKeyFilter,
    selectedEnvironment,
    selectedProject,
    timeRange,
  ]);

  const filteredEvents = useMemo(
    () =>
      events.filter((event) => {
        const searchable = [
          event.action,
          event.actorType,
          event.actorId,
          event.environment,
          event.secretKey,
          event.tokenPrefix,
          event.reason,
          event.correlationId,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

        return (
          (actorTypeFilter === "all" || event.actorType === actorTypeFilter) &&
          (search.trim().length === 0 || searchable.includes(search.trim().toLowerCase()))
        );
      }),
    [actorTypeFilter, events, search],
  );

  const summary = useMemo(
    () => ({
      total: events.length,
      success: events.filter((event) => event.result === "success").length,
      failure: events.filter((event) => event.result === "failure").length,
      reveals: events.filter((event) => event.action === "vault.secret.reveal").length,
    }),
    [events],
  );

  async function copyEvent(event: VaultAuditEvent): Promise<void> {
    await navigator.clipboard.writeText(JSON.stringify(event, null, 2));
    setMessage("Audit event copied.");
  }

  return (
    <main className="mx-auto flex max-w-7xl flex-col gap-5">
      <header className="flex flex-col gap-3 border-b border-slate-200 pb-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-sm font-medium text-cyan-700">
            {selectedProject?.name ?? "No project selected"} / {selectedEnvironment}
          </p>
          <h1 className="text-2xl font-semibold tracking-normal">Vault audit logs</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
            Inspect sensitive vault actions without exposing raw secret values, vault passwords, or
            raw integration tokens.
          </p>
        </div>
        <Button className="w-auto" onClick={() => void loadAudit()} type="button" variant="outline">
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

      <section className="grid gap-3 md:grid-cols-4">
        <Summary label="Audit events" value={summary.total} />
        <Summary label="Success" value={summary.success} />
        <Summary label="Failures" value={summary.failure} />
        <Summary label="Reveals" value={summary.reveals} />
      </section>

      <section className="grid gap-3 rounded-md border border-slate-200 bg-white p-4 lg:grid-cols-[1fr_10rem_10rem_10rem]">
        <label className="relative block">
          <span className="sr-only">Search audit events</span>
          <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-slate-400" />
          <Input
            className="pl-9"
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search action, actor, secret, request id"
            value={search}
          />
        </label>

        <Input
          onChange={(event) => setActionFilter(event.target.value)}
          placeholder="Action"
          value={actionFilter}
        />

        <select
          className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm capitalize shadow-sm outline-none focus:ring-2 focus:ring-cyan-700"
          onChange={(event) => setResultFilter(event.target.value as ResultFilter)}
          value={resultFilter}
        >
          {results.map((result) => (
            <option key={result} value={result}>
              {result}
            </option>
          ))}
        </select>

        <select
          className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm capitalize shadow-sm outline-none focus:ring-2 focus:ring-cyan-700"
          onChange={(event) => setActorTypeFilter(event.target.value as ActorTypeFilter)}
          value={actorTypeFilter}
        >
          {actorTypes.map((actorType) => (
            <option key={actorType} value={actorType}>
              {actorType}
            </option>
          ))}
        </select>

        <select
          className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm capitalize shadow-sm outline-none focus:ring-2 focus:ring-cyan-700"
          onChange={(event) => setEnvironmentFilter(event.target.value)}
          value={environmentFilter}
        >
          <option value="all">all envs</option>
          {dashboardEnvironments.map((environment) => (
            <option key={environment} value={environment}>
              {environment}
            </option>
          ))}
        </select>

        <Input
          onChange={(event) => setSecretKeyFilter(event.target.value)}
          placeholder="Secret key"
          value={secretKeyFilter}
        />

        <Input
          onChange={(event) => setActorFilter(event.target.value)}
          placeholder="Actor id"
          value={actorFilter}
        />

        <select
          className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm shadow-sm outline-none focus:ring-2 focus:ring-cyan-700"
          onChange={(event) => setTimeRange(event.target.value as AuditTimeRange)}
          value={timeRange}
        >
          {auditTimeRanges.map((range) => (
            <option key={range} value={range}>
              {range}
            </option>
          ))}
        </select>
      </section>

      <section className="grid gap-4 xl:grid-cols-[1fr_26rem]">
        <div className="rounded-md border border-slate-200 bg-white">
          <div className="grid grid-cols-[1fr_8rem_9rem_8rem] gap-3 border-b border-slate-100 px-4 py-3 text-xs font-semibold uppercase tracking-normal text-slate-500">
            <span>Action</span>
            <span>Result</span>
            <span>Actor</span>
            <span className="text-right">When</span>
          </div>
          {filteredEvents.length === 0 ? (
            <p className="px-4 py-6 text-sm text-slate-500">
              {isLoading ? "Loading audit events" : "No audit events match the current filters"}
            </p>
          ) : (
            <div className="divide-y divide-slate-100">
              {filteredEvents.map((event) => (
                <button
                  className="grid w-full grid-cols-[1fr_8rem_9rem_8rem] items-center gap-3 px-4 py-3 text-left transition hover:bg-slate-50"
                  key={event.id}
                  onClick={() => setSelectedEvent(event)}
                  type="button"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <ShieldCheck className="h-4 w-4 shrink-0 text-cyan-700" />
                      <p className="truncate text-sm font-semibold text-slate-900">
                        {event.action}
                      </p>
                    </div>
                    <p className="mt-1 truncate text-xs text-slate-500">
                      {event.environment ?? "-"} / {event.secretKey ?? event.tokenPrefix ?? "-"}
                    </p>
                  </div>
                  <span className={event.result === "success" ? successClass : failureClass}>
                    {event.result}
                  </span>
                  <span className="truncate text-xs text-slate-600">
                    {event.actorType}:{event.actorId}
                  </span>
                  <span className="text-right text-xs text-slate-500">
                    {formatRelativeTime(event.occurredAt)}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        <aside className="rounded-md border border-slate-200 bg-white p-4">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-sm font-semibold uppercase tracking-normal text-slate-500">
              Audit detail
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
            <p className="mt-6 text-sm text-slate-500">Select an audit event to inspect it.</p>
          ) : (
            <dl className="mt-4 grid gap-3 text-sm">
              <Detail label="Action" value={selectedEvent.action} />
              <Detail label="Result" value={selectedEvent.result} />
              <Detail label="Actor" value={`${selectedEvent.actorType}:${selectedEvent.actorId}`} />
              <Detail label="Environment" value={selectedEvent.environment ?? "-"} />
              <Detail label="Secret key" value={selectedEvent.secretKey ?? "-"} mono />
              <Detail label="Token prefix" value={selectedEvent.tokenPrefix ?? "-"} mono />
              <Detail label="Reason" value={selectedEvent.reason ?? "-"} />
              <Detail label="Request ID" value={selectedEvent.correlationId} mono />
              <Detail
                label="Occurred"
                value={new Date(selectedEvent.occurredAt).toLocaleString()}
              />
            </dl>
          )}
        </aside>
      </section>
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

const successClass =
  "w-fit rounded-md border border-emerald-200 bg-emerald-50 px-2 py-1 text-xs font-medium capitalize text-emerald-700";

const failureClass =
  "w-fit rounded-md border border-red-200 bg-red-50 px-2 py-1 text-xs font-medium capitalize text-red-700";

function upsertAuditEvent(events: VaultAuditEvent[], incoming: VaultAuditEvent): VaultAuditEvent[] {
  const eventsById = new Map<string, VaultAuditEvent>();

  for (const event of [incoming, ...events]) {
    eventsById.set(event.id, event);
  }

  return [...eventsById.values()].sort(
    (left, right) => Date.parse(right.occurredAt) - Date.parse(left.occurredAt),
  );
}

function buildAuditFilters(input: {
  readonly actionFilter: string;
  readonly actorFilter: string;
  readonly environmentFilter: string;
  readonly resultFilter: ResultFilter;
  readonly secretKeyFilter: string;
  readonly timeRange: AuditTimeRange;
}): VaultAuditFilters {
  return {
    ...(input.actionFilter.trim().length === 0 ? {} : { action: input.actionFilter.trim() }),
    ...(input.actorFilter.trim().length === 0 ? {} : { actor: input.actorFilter.trim() }),
    ...(input.environmentFilter === "all" ? {} : { environment: input.environmentFilter }),
    ...(input.resultFilter === "all" ? {} : { result: input.resultFilter }),
    ...(input.secretKeyFilter.trim().length === 0
      ? {}
      : { secretKey: input.secretKeyFilter.trim() }),
    ...toTimeFilter(input.timeRange),
  };
}

function toTimeFilter(timeRange: AuditTimeRange): Pick<VaultAuditFilters, "occurredAfter"> {
  if (timeRange === "all") {
    return {};
  }

  const millisecondsByRange: Record<Exclude<AuditTimeRange, "all">, number> = {
    "1h": 60 * 60 * 1000,
    "6h": 6 * 60 * 60 * 1000,
    "24h": 24 * 60 * 60 * 1000,
    "7d": 7 * 24 * 60 * 60 * 1000,
  };

  return {
    occurredAfter: new Date(Date.now() - millisecondsByRange[timeRange]).toISOString(),
  };
}

function auditEventMatchesFilters(
  event: VaultAuditEvent,
  filters: VaultAuditFilters,
  actorTypeFilter: ActorTypeFilter,
  search: string,
): boolean {
  const searchable = [
    event.action,
    event.actorType,
    event.actorId,
    event.environment,
    event.secretKey,
    event.tokenPrefix,
    event.reason,
    event.correlationId,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return (
    (filters.action === undefined || event.action === filters.action) &&
    (filters.result === undefined || event.result === filters.result) &&
    (filters.environment === undefined || event.environment === filters.environment) &&
    (filters.secretKey === undefined || event.secretKey === filters.secretKey) &&
    (filters.actor === undefined ||
      event.actorId === filters.actor ||
      event.actorType === filters.actor) &&
    (filters.occurredAfter === undefined ||
      Date.parse(event.occurredAt) >= Date.parse(filters.occurredAfter)) &&
    (actorTypeFilter === "all" || event.actorType === actorTypeFilter) &&
    (search.trim().length === 0 || searchable.includes(search.trim().toLowerCase()))
  );
}
