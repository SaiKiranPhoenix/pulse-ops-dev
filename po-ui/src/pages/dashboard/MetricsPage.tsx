import { Activity, BarChart3, RefreshCw, Timer } from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Button } from "@/components/ui/button";
import { listDashboardEvents, type DashboardEvent } from "@/features/dashboards/api";
import { getApiErrorMessage } from "@/lib/api-client";
import { useDashboardContext } from "./DashboardLayout";

type Bucket = {
  readonly label: string;
  readonly events: number;
  readonly logs: number;
  readonly errors: number;
  readonly metrics: number;
  readonly avgLatency: number;
};

export function MetricsPage() {
  const { selectedEnvironment, selectedProject } = useDashboardContext();
  const [events, setEvents] = useState<DashboardEvent[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadMetrics(): Promise<void> {
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
    void loadMetrics();
  }, [selectedProject?.id]);

  const metrics = useMemo(() => buildMetrics(events), [events]);

  return (
    <main className="mx-auto flex max-w-7xl flex-col gap-5">
      <header className="flex flex-col gap-3 border-b border-slate-200 pb-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-sm font-medium text-cyan-700">
            {selectedProject?.name ?? "No project selected"} / {selectedEnvironment}
          </p>
          <h1 className="text-2xl font-semibold tracking-normal">Metrics explorer</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
            View throughput, error volume, and metric samples from processed telemetry.
          </p>
        </div>
        <Button
          className="w-auto"
          onClick={() => void loadMetrics()}
          type="button"
          variant="outline"
        >
          <RefreshCw className="h-4 w-4" />
          Refresh
        </Button>
      </header>

      {error !== null ? (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      <section className="grid gap-3 md:grid-cols-4">
        <MetricCard
          label="Events"
          value={metrics.totalEvents}
          icon={<Activity className="h-4 w-4" />}
        />
        <MetricCard
          label="Logs"
          value={metrics.logCount}
          icon={<BarChart3 className="h-4 w-4" />}
        />
        <MetricCard
          label="Errors"
          value={metrics.errorCount}
          icon={<BarChart3 className="h-4 w-4" />}
        />
        <MetricCard
          label="Avg metric value"
          value={metrics.avgMetricValue}
          icon={<Timer className="h-4 w-4" />}
        />
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <ChartPanel title="Event throughput" empty={metrics.buckets.length === 0 && !isLoading}>
          <ResponsiveContainer height={280} width="100%">
            <BarChart data={metrics.buckets}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="label" tickLine={false} />
              <YAxis allowDecimals={false} tickLine={false} />
              <Tooltip />
              <Bar dataKey="logs" fill="#0891b2" stackId="events" />
              <Bar dataKey="errors" fill="#dc2626" stackId="events" />
              <Bar dataKey="metrics" fill="#2563eb" stackId="events" />
            </BarChart>
          </ResponsiveContainer>
        </ChartPanel>

        <ChartPanel title="Metric values" empty={metrics.metricSamples.length === 0 && !isLoading}>
          <ResponsiveContainer height={280} width="100%">
            <LineChart data={metrics.metricSamples}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="label" tickLine={false} />
              <YAxis tickLine={false} />
              <Tooltip />
              <Line dataKey="value" dot={false} stroke="#0e7490" strokeWidth={2} type="monotone" />
            </LineChart>
          </ResponsiveContainer>
        </ChartPanel>
      </section>

      <section className="rounded-md border border-slate-200 bg-white">
        <div className="grid grid-cols-[1fr_7rem_8rem] gap-3 border-b border-slate-100 px-4 py-3 text-xs font-semibold uppercase tracking-normal text-slate-500">
          <span>Metric</span>
          <span>Value</span>
          <span className="text-right">Observed</span>
        </div>
        {metrics.metricEvents.length === 0 ? (
          <p className="px-4 py-6 text-sm text-slate-500">
            {isLoading ? "Loading metrics" : "No metric events yet"}
          </p>
        ) : (
          <div className="divide-y divide-slate-100">
            {metrics.metricEvents.map((event) => (
              <article
                className="grid grid-cols-[1fr_7rem_8rem] items-center gap-3 px-4 py-3"
                key={event.id}
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-slate-900">
                    {event.name ?? event.fingerprint}
                  </p>
                  <p className="mt-1 truncate text-xs text-slate-500">{event.source}</p>
                </div>
                <span className="font-mono text-sm text-slate-700">
                  {event.value === null ? "-" : event.value}
                </span>
                <span className="text-right text-xs text-slate-500">
                  {new Date(event.observedAt).toLocaleTimeString()}
                </span>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}

function MetricCard({
  icon,
  label,
  value,
}: {
  readonly icon: ReactNode;
  readonly label: string;
  readonly value: number | string;
}) {
  return (
    <div className="rounded-md border border-slate-200 bg-white p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium text-slate-500">{label}</p>
        <span className="text-cyan-700">{icon}</span>
      </div>
      <p className="mt-3 text-2xl font-semibold tabular-nums">{value}</p>
    </div>
  );
}

function ChartPanel({
  children,
  empty,
  title,
}: {
  readonly children: ReactNode;
  readonly empty: boolean;
  readonly title: string;
}) {
  return (
    <section className="rounded-md border border-slate-200 bg-white p-4">
      <h2 className="text-sm font-semibold uppercase tracking-normal text-slate-500">{title}</h2>
      <div className="mt-3">
        {empty ? (
          <p className="py-20 text-center text-sm text-slate-500">No chart data yet</p>
        ) : (
          children
        )}
      </div>
    </section>
  );
}

function buildMetrics(events: DashboardEvent[]) {
  const metricEvents = events.filter((event) => event.type === "metric");
  const metricValues = metricEvents
    .map((event) => event.value)
    .filter((value): value is number => value !== null);
  const avgMetricValue =
    metricValues.length === 0
      ? "-"
      : Math.round(metricValues.reduce((total, value) => total + value, 0) / metricValues.length);

  return {
    totalEvents: events.length,
    logCount: events.filter((event) => event.type === "log").length,
    errorCount: events.filter((event) => event.type === "error").length,
    avgMetricValue,
    buckets: buildBuckets(events),
    metricEvents,
    metricSamples: metricEvents
      .slice()
      .reverse()
      .slice(-30)
      .map((event) => ({
        label: new Date(event.observedAt).toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        }),
        value: event.value ?? 0,
      })),
  };
}

function buildBuckets(events: DashboardEvent[]): Bucket[] {
  const buckets = new Map<string, { logs: number; errors: number; metrics: number }>();

  for (const event of events) {
    const date = new Date(event.receivedAt);
    const label = date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    const bucket = buckets.get(label) ?? { logs: 0, errors: 0, metrics: 0 };

    if (event.type === "log") {
      bucket.logs += 1;
    } else if (event.type === "error") {
      bucket.errors += 1;
    } else {
      bucket.metrics += 1;
    }

    buckets.set(label, bucket);
  }

  return [...buckets.entries()].slice(-12).map(([label, bucket]) => ({
    label,
    events: bucket.logs + bucket.errors + bucket.metrics,
    logs: bucket.logs,
    errors: bucket.errors,
    metrics: bucket.metrics,
    avgLatency: 0,
  }));
}
