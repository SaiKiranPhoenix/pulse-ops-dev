import { Clipboard, GitBranch, RefreshCw, Search, Send, Timer } from "lucide-react";
import { type FormEvent, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { listDashboardEvents, type DashboardEvent } from "@/features/dashboards/api";
import { ingestError, ingestLog, ingestMetric } from "@/features/ingestion/api";
import { getApiErrorMessage } from "@/lib/api-client";
import { formatRelativeTime } from "./dashboard-utils";
import { useDashboardContext } from "./DashboardLayout";

type TraceSpan = {
  readonly id: string;
  readonly traceId: string;
  readonly spanId: string;
  readonly parentSpanId: string | null;
  readonly service: string;
  readonly operation: string;
  readonly event: DashboardEvent;
  readonly startedAt: string;
  readonly durationMs: number;
  readonly status: "ok" | "error";
};

type TraceGroup = {
  readonly traceId: string;
  readonly rootService: string;
  readonly startedAt: string;
  readonly endedAt: string;
  readonly durationMs: number;
  readonly errorCount: number;
  readonly spans: TraceSpan[];
  readonly services: string[];
};

export function TracesPage() {
  const { selectedEnvironment, selectedProject } = useDashboardContext();
  const [events, setEvents] = useState<DashboardEvent[]>([]);
  const [selectedTraceId, setSelectedTraceId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [testApiKey, setTestApiKey] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSendingTrace, setIsSendingTrace] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function loadTraces(): Promise<void> {
    if (selectedProject === null) {
      setEvents([]);
      setSelectedTraceId(null);
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
    void loadTraces();
  }, [selectedProject?.id]);

  const traces = useMemo(() => buildTraceGroups(events), [events]);
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

  const selectedTrace = useMemo(
    () => filteredTraces.find((trace) => trace.traceId === selectedTraceId) ?? null,
    [filteredTraces, selectedTraceId],
  );

  const summary = useMemo(
    () => ({
      traces: traces.length,
      spans: traces.reduce((total, trace) => total + trace.spans.length, 0),
      errors: traces.reduce((total, trace) => total + trace.errorCount, 0),
      services: new Set(traces.flatMap((trace) => trace.services)).size,
    }),
    [traces],
  );

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

      setMessage("Synthetic trace accepted. Refresh after workers process the events.");
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
            {selectedProject?.name ?? "No project selected"} / {selectedEnvironment}
          </p>
          <h1 className="text-2xl font-semibold tracking-normal">Trace correlation</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
            Correlate logs, errors, and metrics into traces using telemetry attributes: `traceId`,
            `spanId`, and `parentSpanId`.
          </p>
        </div>
        <Button
          className="w-auto"
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

      <section className="grid gap-3 md:grid-cols-4">
        <Summary label="Traces" value={summary.traces} />
        <Summary label="Spans" value={summary.spans} />
        <Summary label="Errored spans" value={summary.errors} />
        <Summary label="Services" value={summary.services} />
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

        <form className="flex gap-2" onSubmit={sendSyntheticTrace}>
          <Input
            onChange={(event) => setTestApiKey(event.target.value)}
            placeholder="API key for synthetic trace"
            type="password"
            value={testApiKey}
          />
          <Button className="w-auto" disabled={isSendingTrace} type="submit">
            <Send className="h-4 w-4" />
          </Button>
        </form>
      </section>

      <section className="grid gap-4 xl:grid-cols-[25rem_1fr]">
        <div className="rounded-md border border-slate-200 bg-white">
          <div className="grid grid-cols-[1fr_6rem_7rem] gap-3 border-b border-slate-100 px-4 py-3 text-xs font-semibold uppercase tracking-normal text-slate-500">
            <span>Trace</span>
            <span>Spans</span>
            <span className="text-right">Duration</span>
          </div>
          {filteredTraces.length === 0 ? (
            <p className="px-4 py-6 text-sm text-slate-500">
              {isLoading ? "Loading traces" : "No trace-correlated events yet"}
            </p>
          ) : (
            <div className="divide-y divide-slate-100">
              {filteredTraces.map((trace) => (
                <button
                  className="grid w-full grid-cols-[1fr_6rem_7rem] items-center gap-3 px-4 py-3 text-left transition hover:bg-slate-50"
                  key={trace.traceId}
                  onClick={() => setSelectedTraceId(trace.traceId)}
                  type="button"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <GitBranch className="h-4 w-4 shrink-0 text-cyan-700" />
                      <p className="truncate font-mono text-sm font-semibold text-slate-900">
                        {trace.traceId}
                      </p>
                    </div>
                    <p className="mt-1 truncate text-xs text-slate-500">
                      {trace.rootService} - {trace.services.join(", ")}
                    </p>
                  </div>
                  <span className="font-mono text-sm text-slate-700">{trace.spans.length}</span>
                  <span className="text-right font-mono text-sm text-slate-700">
                    {trace.durationMs}ms
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        <aside className="rounded-md border border-slate-200 bg-white p-4">
          {selectedTrace === null ? (
            <p className="text-sm text-slate-500">Select a trace to inspect the waterfall.</p>
          ) : (
            <TraceDetail trace={selectedTrace} onCopy={() => void copyTrace(selectedTrace)} />
          )}
        </aside>
      </section>
    </main>
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
        <Button className="h-9 w-9 px-0" onClick={onCopy} type="button" variant="outline">
          <Clipboard className="h-4 w-4" />
        </Button>
      </div>

      <section className="grid gap-3 md:grid-cols-3">
        <SmallMetric label="Duration" value={`${trace.durationMs}ms`} />
        <SmallMetric label="Spans" value={String(trace.spans.length)} />
        <SmallMetric label="Errors" value={String(trace.errorCount)} />
      </section>

      <section>
        <h3 className="text-sm font-semibold uppercase tracking-normal text-slate-500">
          Service map
        </h3>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {trace.services.map((service, index) => (
            <span className="flex items-center gap-2" key={service}>
              <span className="rounded-md border border-cyan-200 bg-cyan-50 px-2 py-1 text-xs font-medium text-cyan-700">
                {service}
              </span>
              {index < trace.services.length - 1 ? (
                <span className="text-xs text-slate-400">-&gt;</span>
              ) : null}
            </span>
          ))}
        </div>
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
                  className={`h-2 rounded-full ${span.status === "error" ? "bg-red-500" : "bg-cyan-600"}`}
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

function buildTraceGroups(events: DashboardEvent[]): TraceGroup[] {
  const spans = events.map(toTraceSpan).filter((span): span is TraceSpan => span !== null);
  const traces = new Map<string, TraceSpan[]>();

  for (const span of spans) {
    const traceSpans = traces.get(span.traceId) ?? [];
    traceSpans.push(span);
    traces.set(span.traceId, traceSpans);
  }

  return [...traces.entries()]
    .map(([traceId, traceSpans]) => {
      const sortedSpans = traceSpans
        .slice()
        .sort((left, right) => Date.parse(left.startedAt) - Date.parse(right.startedAt));
      const startedAt = sortedSpans[0]?.startedAt ?? new Date().toISOString();
      const endedAt = sortedSpans.at(-1)?.startedAt ?? startedAt;
      const durationMs = Math.max(
        ...sortedSpans.map(
          (span) => Date.parse(span.startedAt) - Date.parse(startedAt) + span.durationMs,
        ),
        1,
      );

      return {
        traceId,
        rootService:
          sortedSpans.find((span) => span.parentSpanId === null)?.service ??
          sortedSpans[0]?.service ??
          "unknown",
        startedAt,
        endedAt,
        durationMs,
        errorCount: sortedSpans.filter((span) => span.status === "error").length,
        spans: sortedSpans,
        services: [...new Set(sortedSpans.map((span) => span.service))],
      };
    })
    .sort((left, right) => Date.parse(right.startedAt) - Date.parse(left.startedAt));
}

function toTraceSpan(event: DashboardEvent): TraceSpan | null {
  const traceId = readAttribute(event.attributes, "traceId");
  const spanId = readAttribute(event.attributes, "spanId");

  if (traceId === null || spanId === null) {
    return null;
  }

  return {
    id: event.id,
    traceId,
    spanId,
    parentSpanId: readAttribute(event.attributes, "parentSpanId"),
    service: event.source,
    operation:
      readAttribute(event.attributes, "operation") ??
      event.message ??
      event.name ??
      event.fingerprint,
    event,
    startedAt: event.observedAt,
    durationMs: readNumberAttribute(event.attributes, "durationMs") ?? event.value ?? 1,
    status: event.type === "error" || event.level === "error" ? "error" : "ok",
  };
}

function readAttribute(attributes: Record<string, unknown>, key: string): string | null {
  const value = attributes[key];
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}

function readNumberAttribute(attributes: Record<string, unknown>, key: string): number | null {
  const value = attributes[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
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
    `Spans: ${trace.spans.length}`,
    `Errors: ${trace.errorCount}`,
    `Services: ${trace.services.join(", ")}`,
  ].join("\n");
}

const okClass =
  "w-fit rounded-md border border-emerald-200 bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-700";

const errorClass =
  "w-fit rounded-md border border-red-200 bg-red-50 px-2 py-1 text-xs font-medium text-red-700";
