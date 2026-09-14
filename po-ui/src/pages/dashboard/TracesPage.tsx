import { Clipboard, GitBranch, RefreshCw, Search, Send, Timer, TriangleAlert } from "lucide-react";
import { type FormEvent, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  getTraceSummary,
  type RealtimeEventCreated,
  type TraceGroup,
  type TraceSummary,
} from "@/features/dashboards/api";
import { ingestError, ingestLog, ingestMetric } from "@/features/ingestion/api";
import { getApiErrorMessage } from "@/lib/api-client";
import { createPulseOpsSocket, joinProjectRoom, leaveProjectRoom } from "@/lib/socket-client";
import { formatRelativeTime } from "./dashboard-utils";
import { useDashboardContext } from "./DashboardLayout";

export function TracesPage() {
  const { selectedEnvironment, selectedProject, selectedTimeRange } = useDashboardContext();
  const [summary, setSummary] = useState<TraceSummary | null>(null);
  const [selectedTraceId, setSelectedTraceId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [testApiKey, setTestApiKey] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSendingTrace, setIsSendingTrace] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function loadTraces(): Promise<void> {
    if (selectedProject === null) {
      setSummary(null);
      setSelectedTraceId(null);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      setSummary(
        await getTraceSummary(selectedProject.id, {
          environment: selectedEnvironment,
          timeRange: selectedTimeRange,
        }),
      );
    } catch (requestError) {
      setError(getApiErrorMessage(requestError));
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadTraces();
  }, [selectedEnvironment, selectedProject?.id, selectedTimeRange]);

  useEffect(() => {
    if (selectedProject === null) {
      return;
    }

    const socket = createPulseOpsSocket();

    if (socket === null) {
      return;
    }

    let refreshTimeout: number | null = null;
    socket.on("connect", () => {
      void joinProjectRoom(socket, selectedProject.id, selectedEnvironment);
      void loadTraces();
    });
    socket.on("event.created", (update: RealtimeEventCreated) => {
      if (update.event.attributes.traceId !== undefined && refreshTimeout === null) {
        refreshTimeout = window.setTimeout(() => {
          refreshTimeout = null;
          void loadTraces();
        }, 750);
      }
    });
    socket.connect();

    return () => {
      if (refreshTimeout !== null) {
        window.clearTimeout(refreshTimeout);
      }
      leaveProjectRoom(socket, selectedProject.id, selectedEnvironment);
      socket.disconnect();
    };
  }, [selectedEnvironment, selectedProject, selectedTimeRange]);

  const traces = summary?.traces ?? [];
  const filteredTraces = useMemo(
    () =>
      traces.filter((trace) => {
        const searchable = [trace.traceId, trace.rootService, ...trace.services]
          .join(" ")
          .toLowerCase();
        return search.trim().length === 0 || searchable.includes(search.trim().toLowerCase());
      }),
    [search, traces],
  );

  useEffect(() => {
    setSelectedTraceId((current) =>
      current === null
        ? (filteredTraces[0]?.traceId ?? null)
        : filteredTraces.some((trace) => trace.traceId === current)
          ? current
          : (filteredTraces[0]?.traceId ?? null),
    );
  }, [filteredTraces]);

  const selectedTrace = filteredTraces.find((trace) => trace.traceId === selectedTraceId) ?? null;

  async function sendSyntheticTrace(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();

    if (testApiKey.trim().length === 0) {
      setError("Paste an ingestion API key before sending a synthetic trace.");
      return;
    }

    const traceId = `trace_${crypto.randomUUID()}`;
    const apiKey = testApiKey.trim();

    setIsSendingTrace(true);
    setError(null);
    setMessage(null);

    try {
      await ingestLog(
        { apiKey, idempotencyKey: `${traceId}:gateway` },
        {
          source: "api-gateway",
          level: "info",
          message: "HTTP POST /checkout",
          fingerprint: `${traceId}:gateway`,
          attributes: traceAttributes(traceId, "span_gateway", null, "POST /checkout", 42),
        },
      );
      await ingestMetric(
        { apiKey, idempotencyKey: `${traceId}:payments` },
        {
          source: "payment-service",
          name: "checkout.payment.latency",
          value: 238,
          unit: "ms",
          fingerprint: `${traceId}:payments`,
          attributes: traceAttributes(traceId, "span_payments", "span_gateway", "charge card", 238),
        },
      );
      await ingestError(
        { apiKey, idempotencyKey: `${traceId}:inventory` },
        {
          source: "inventory-service",
          name: "InventoryReservationError",
          message: "Inventory reservation retry required",
          fingerprint: `${traceId}:inventory`,
          attributes: traceAttributes(
            traceId,
            "span_inventory",
            "span_gateway",
            "reserve inventory",
            96,
          ),
        },
      );

      setMessage("Synthetic trace accepted. The page refreshes when processed events arrive.");
      await loadTraces();
    } catch (requestError) {
      setError(getApiErrorMessage(requestError));
    } finally {
      setIsSendingTrace(false);
    }
  }

  async function copyTrace(trace: TraceGroup): Promise<void> {
    await navigator.clipboard.writeText(toTraceSummary(trace));
    setMessage("Trace summary copied.");
  }

  return (
    <main className="mx-auto flex max-w-7xl flex-col gap-5">
      <header className="flex flex-col gap-3 border-b border-slate-200 pb-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-sm font-medium text-cyan-700">
            {selectedProject?.name ?? "No project selected"} / {selectedEnvironment} /{" "}
            {selectedTimeRange}
          </p>
          <h1 className="text-2xl font-semibold tracking-normal">Traces and APM</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
            Inspect distributed traces, slow spans, service dependencies, and endpoint latency from
            correlated telemetry.
          </p>
        </div>
        <Button
          className="w-full sm:w-auto"
          onClick={() => void loadTraces()}
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

      <section className="grid gap-3 md:grid-cols-5">
        <Summary label="Traces" value={summary?.totalTraces ?? 0} />
        <Summary label="Spans" value={summary?.totalSpans ?? 0} />
        <Summary label="Errored traces" value={summary?.errorTraces ?? 0} />
        <Summary label="Slow traces" value={summary?.slowTraces ?? 0} />
        <Summary label="Services" value={summary?.serviceCount ?? 0} />
      </section>

      <section className="grid gap-3 rounded-md border border-slate-200 bg-white p-4 xl:grid-cols-[1fr_22rem]">
        <label className="relative block">
          <span className="sr-only">Search traces</span>
          <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-slate-400" />
          <Input
            className="pl-9"
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search trace id or service"
            value={search}
          />
        </label>

        <form className="flex flex-col gap-2 sm:flex-row" onSubmit={sendSyntheticTrace}>
          <Input
            onChange={(event) => setTestApiKey(event.target.value)}
            placeholder="API key for synthetic trace"
            type="password"
            value={testApiKey}
          />
          <Button className="w-full sm:w-auto" disabled={isSendingTrace} type="submit">
            <Send className="h-4 w-4" />
          </Button>
        </form>
      </section>

      <section className="grid gap-4 xl:grid-cols-[25rem_1fr]">
        <TraceList
          isLoading={isLoading}
          onSelect={setSelectedTraceId}
          selectedTraceId={selectedTraceId}
          traces={filteredTraces}
        />

        <aside className="rounded-md border border-slate-200 bg-white p-4">
          {selectedTrace === null ? (
            <p className="text-sm text-slate-500">Select a trace to inspect the waterfall.</p>
          ) : (
            <TraceDetail trace={selectedTrace} onCopy={() => void copyTrace(selectedTrace)} />
          )}
        </aside>
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <section className="overflow-x-auto rounded-md border border-slate-200 bg-white">
          <div className="border-b border-slate-100 px-4 py-3 text-sm font-semibold uppercase tracking-normal text-slate-500">
            Endpoint performance
          </div>
          <div className="divide-y divide-slate-100">
            {(summary?.endpoints ?? []).length === 0 ? (
              <p className="px-4 py-6 text-sm text-slate-500">No span endpoints observed.</p>
            ) : (
              summary?.endpoints.slice(0, 10).map((endpoint) => (
                <article
                  className="grid min-w-[34rem] grid-cols-[1fr_5rem_5rem_6rem] items-center gap-3 px-4 py-3 text-sm"
                  key={`${endpoint.service}:${endpoint.operation}`}
                >
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-slate-900">{endpoint.operation}</p>
                    <p className="truncate text-xs text-slate-500">{endpoint.service}</p>
                  </div>
                  <span className="text-right font-mono text-slate-700">{endpoint.spanCount}</span>
                  <span className="text-right font-mono text-red-700">{endpoint.errorCount}</span>
                  <span className="text-right font-mono text-slate-700">
                    {endpoint.p95DurationMs}ms
                  </span>
                </article>
              ))
            )}
          </div>
        </section>

        <section className="overflow-x-auto rounded-md border border-slate-200 bg-white">
          <div className="border-b border-slate-100 px-4 py-3 text-sm font-semibold uppercase tracking-normal text-slate-500">
            Service dependencies
          </div>
          <div className="divide-y divide-slate-100">
            {(summary?.serviceMap ?? []).length === 0 ? (
              <p className="px-4 py-6 text-sm text-slate-500">No cross-service edges observed.</p>
            ) : (
              summary?.serviceMap.map((edge) => (
                <article
                  className="grid min-w-[30rem] grid-cols-[1fr_5rem_6rem] items-center gap-3 px-4 py-3 text-sm"
                  key={`${edge.from}:${edge.to}`}
                >
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-slate-900">
                      {edge.from} -&gt; {edge.to}
                    </p>
                    <p className="text-xs text-slate-500">{edge.errorCount} errored spans</p>
                  </div>
                  <span className="text-right font-mono text-slate-700">{edge.spanCount}</span>
                  <span className="text-right font-mono text-slate-700">
                    {edge.avgDurationMs}ms
                  </span>
                </article>
              ))
            )}
          </div>
        </section>
      </section>
    </main>
  );
}

function TraceList({
  isLoading,
  onSelect,
  selectedTraceId,
  traces,
}: {
  readonly isLoading: boolean;
  readonly onSelect: (traceId: string) => void;
  readonly selectedTraceId: string | null;
  readonly traces: TraceGroup[];
}) {
  return (
    <div className="overflow-x-auto rounded-md border border-slate-200 bg-white">
      <div className="grid min-w-[32rem] grid-cols-[1fr_6rem_7rem] gap-3 border-b border-slate-100 px-4 py-3 text-xs font-semibold uppercase tracking-normal text-slate-500">
        <span>Trace</span>
        <span>Spans</span>
        <span className="text-right">Duration</span>
      </div>
      {traces.length === 0 ? (
        <p className="px-4 py-6 text-sm text-slate-500">
          {isLoading ? "Loading traces" : "No trace-correlated events yet"}
        </p>
      ) : (
        <div className="min-w-[32rem] divide-y divide-slate-100">
          {traces.map((trace) => (
            <button
              className={`grid w-full grid-cols-[1fr_6rem_7rem] items-center gap-3 px-4 py-3 text-left transition hover:bg-slate-50 ${
                selectedTraceId === trace.traceId ? "bg-cyan-50" : ""
              }`}
              key={trace.traceId}
              onClick={() => onSelect(trace.traceId)}
              type="button"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  {trace.isSlow || trace.errorCount > 0 ? (
                    <TriangleAlert className="h-4 w-4 shrink-0 text-amber-600" />
                  ) : (
                    <GitBranch className="h-4 w-4 shrink-0 text-cyan-700" />
                  )}
                  <p className="truncate font-mono text-sm font-semibold text-slate-900">
                    {trace.traceId}
                  </p>
                </div>
                <p className="mt-1 truncate text-xs text-slate-500">
                  {trace.rootService} - {trace.services.join(", ")}
                </p>
              </div>
              <span className="font-mono text-sm text-slate-700">{trace.spanCount}</span>
              <span className="text-right font-mono text-sm text-slate-700">
                {trace.durationMs}ms
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function TraceDetail({
  onCopy,
  trace,
}: {
  readonly onCopy: () => void;
  readonly trace: TraceGroup;
}) {
  return (
    <div className="grid gap-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-normal text-slate-500">
            Trace detail
          </p>
          <h2 className="mt-2 truncate font-mono text-lg font-semibold leading-6 text-slate-950">
            {trace.traceId}
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            {trace.services.length} services - {formatRelativeTime(trace.startedAt)}
          </p>
        </div>
        <Button
          className="h-11 w-11 px-0 sm:h-9 sm:w-9"
          onClick={onCopy}
          type="button"
          variant="outline"
        >
          <Clipboard className="h-4 w-4" />
        </Button>
      </div>

      <section className="grid gap-3 md:grid-cols-4">
        <SmallMetric label="Duration" value={`${trace.durationMs}ms`} />
        <SmallMetric label="Spans" value={String(trace.spanCount)} />
        <SmallMetric label="Errors" value={String(trace.errorCount)} />
        <SmallMetric label="Slow spans" value={String(trace.slowSpanCount)} />
      </section>

      <section>
        <h3 className="text-sm font-semibold uppercase tracking-normal text-slate-500">
          Waterfall
        </h3>
        <div className="mt-3 grid gap-3">
          {trace.spans.map((span) => (
            <article className="rounded-md border border-slate-200 bg-slate-50 p-3" key={span.id}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-slate-900">{span.operation}</p>
                  <p className="mt-1 truncate text-xs text-slate-500">
                    {span.service} / {span.spanId}
                  </p>
                </div>
                <span className={span.status === "error" ? errorClass : okClass}>
                  {span.status}
                </span>
              </div>
              <div className="mt-3 h-2 rounded-full bg-slate-200">
                <div
                  className={`h-2 rounded-full ${
                    span.status === "error" ? "bg-red-500" : "bg-cyan-600"
                  }`}
                  style={{
                    width: `${Math.max(8, Math.min(100, (span.durationMs / Math.max(trace.durationMs, 1)) * 100))}%`,
                  }}
                />
              </div>
              <p className="mt-2 flex items-center gap-2 text-xs text-slate-500">
                <Timer className="h-3.5 w-3.5" />
                {span.durationMs}ms, parent {span.parentSpanId ?? "root"}
              </p>
            </article>
          ))}
        </div>
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

function SmallMetric({ label, value }: { readonly label: string; readonly value: string }) {
  return (
    <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
      <p className="text-xs font-semibold uppercase tracking-normal text-slate-500">{label}</p>
      <p className="mt-2 font-mono text-sm font-semibold text-slate-900">{value}</p>
    </div>
  );
}

function traceAttributes(
  traceId: string,
  spanId: string,
  parentSpanId: string | null,
  operation: string,
  durationMs: number,
): Record<string, unknown> {
  return {
    traceId,
    spanId,
    parentSpanId,
    operation,
    durationMs,
  };
}

function toTraceSummary(trace: TraceGroup): string {
  return [
    `Trace: ${trace.traceId}`,
    `Root service: ${trace.rootService}`,
    `Duration: ${trace.durationMs}ms`,
    `Spans: ${trace.spanCount}`,
    `Errors: ${trace.errorCount}`,
    `Slow spans: ${trace.slowSpanCount}`,
    `Services: ${trace.services.join(", ")}`,
  ].join("\n");
}

const okClass =
  "w-fit rounded-md border border-emerald-200 bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-700";

const errorClass =
  "w-fit rounded-md border border-red-200 bg-red-50 px-2 py-1 text-xs font-medium text-red-700";
