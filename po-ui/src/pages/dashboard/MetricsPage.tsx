import { Activity, BarChart3, RefreshCw, Send, Timer } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
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
import { Input } from "@/components/ui/input";
import { getMetricSummary, type MetricSummary } from "@/features/dashboards/api";
import { ingestMetric } from "@/features/ingestion/api";
import { getApiErrorMessage } from "@/lib/api-client";
import { createPulseOpsSocket, joinProjectRoom, leaveProjectRoom } from "@/lib/socket-client";
import { useDashboardContext } from "./DashboardLayout";

export function MetricsPage() {
  const { selectedEnvironment, selectedProject, selectedTimeRange } = useDashboardContext();
  const [metrics, setMetrics] = useState<MetricSummary | null>(null);
  const [testApiKey, setTestApiKey] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSendingTest, setIsSendingTest] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function loadMetrics(): Promise<void> {
    if (selectedProject === null) {
      setMetrics(null);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      setMetrics(
        await getMetricSummary(selectedProject.id, {
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
    void loadMetrics();
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
      void loadMetrics();
    });
    socket.on("event.created", (update) => {
      if (update.event.type !== "metric" || refreshTimeout !== null) {
        return;
      }

      refreshTimeout = window.setTimeout(() => {
        refreshTimeout = null;
        void loadMetrics();
      }, 750);
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

  async function sendHighLatencyTest(): Promise<void> {
    if (testApiKey.trim().length === 0) {
      setError("Paste an ingestion API key before sending a high-latency metric.");
      return;
    }

    setIsSendingTest(true);
    setError(null);
    setMessage(null);

    try {
      await ingestMetric(
        {
          apiKey: testApiKey.trim(),
          idempotencyKey: `metrics-latency-demo-${crypto.randomUUID()}`,
        },
        {
          source: "checkout-api",
          name: "checkout.latency",
          value: 1_250,
          unit: "ms",
          attributes: {
            environment: selectedEnvironment,
            route: "POST /checkout",
            synthetic: true,
          },
        },
      );
      setMessage("High-latency metric accepted. Refresh after the worker processes it.");
      await loadMetrics();
    } catch (requestError) {
      setError(getApiErrorMessage(requestError));
    } finally {
      setIsSendingTest(false);
    }
  }

  return (
    <main className="mx-auto flex max-w-7xl flex-col gap-5">
      <header className="flex flex-col gap-3 border-b border-slate-200 pb-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-sm font-medium text-cyan-700">
            {selectedProject?.name ?? "No project selected"} / {selectedEnvironment} /{" "}
            {selectedTimeRange}
          </p>
          <h1 className="text-2xl font-semibold tracking-normal">Metrics explorer</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
            Track throughput, error rate, latency, and service-level metric samples from processed
            telemetry.
          </p>
        </div>
        <Button
          className="w-full sm:w-auto"
          onClick={() => void loadMetrics()}
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
        <MetricCard
          label="Events"
          value={metrics?.totalEvents ?? 0}
          icon={<Activity className="h-4 w-4" />}
        />
        <MetricCard
          label="Error rate"
          value={`${metrics?.errorRate ?? 0}%`}
          icon={<BarChart3 className="h-4 w-4" />}
        />
        <MetricCard
          label="Avg latency"
          value={formatMs(metrics?.avgLatencyMs ?? null)}
          icon={<Timer className="h-4 w-4" />}
        />
        <MetricCard
          label="p95 latency"
          value={formatMs(metrics?.p95LatencyMs ?? null)}
          icon={<Timer className="h-4 w-4" />}
        />
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <ChartPanel
          title="Event throughput"
          empty={(metrics?.buckets.length ?? 0) === 0 && !isLoading}
        >
          <ResponsiveContainer height={280} width="100%">
            <BarChart data={metrics?.buckets ?? []}>
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

        <ChartPanel
          title="Latency avg and p95"
          empty={(metrics?.buckets.length ?? 0) === 0 && !isLoading}
        >
          <ResponsiveContainer height={280} width="100%">
            <LineChart data={metrics?.buckets ?? []}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="label" tickLine={false} />
              <YAxis tickFormatter={(value) => `${value}ms`} tickLine={false} />
              <Tooltip formatter={(value) => `${value}ms`} />
              <Line
                dataKey="avgLatencyMs"
                dot={false}
                name="Avg"
                stroke="#0e7490"
                strokeWidth={2}
                type="monotone"
              />
              <Line
                dataKey="p95LatencyMs"
                dot={false}
                name="p95"
                stroke="#b91c1c"
                strokeWidth={2}
                type="monotone"
              />
            </LineChart>
          </ResponsiveContainer>
        </ChartPanel>

        <ChartPanel title="Error rate" empty={(metrics?.buckets.length ?? 0) === 0 && !isLoading}>
          <ResponsiveContainer height={260} width="100%">
            <LineChart data={metrics?.buckets ?? []}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="label" tickLine={false} />
              <YAxis tickFormatter={(value) => `${value}%`} tickLine={false} />
              <Tooltip formatter={(value) => `${value}%`} />
              <Line
                dataKey="errorRate"
                dot={false}
                name="Error rate"
                stroke="#dc2626"
                strokeWidth={2}
                type="monotone"
              />
            </LineChart>
          </ResponsiveContainer>
        </ChartPanel>

        <section className="rounded-md border border-slate-200 bg-white p-4">
          <h2 className="text-sm font-semibold uppercase tracking-normal text-slate-500">
            Send high-latency test
          </h2>
          <div className="mt-3 flex flex-col gap-2 sm:flex-row">
            <Input
              onChange={(event) => setTestApiKey(event.target.value)}
              placeholder="Ingestion API key"
              type="password"
              value={testApiKey}
            />
            <Button
              className="w-full sm:w-auto"
              disabled={isSendingTest}
              onClick={() => void sendHighLatencyTest()}
              type="button"
            >
              <Send className="h-4 w-4" />
              Send
            </Button>
          </div>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            Emits `checkout.latency=1250ms` for the selected environment so charts, service
            breakdowns, and incident scripts have visible high-latency data.
          </p>
        </section>
      </section>

      <section className="grid gap-4 xl:grid-cols-[1fr_24rem]">
        <div className="overflow-x-auto rounded-md border border-slate-200 bg-white">
          <div className="grid min-w-[42rem] grid-cols-[1fr_5rem_5rem_5rem_6rem_7rem] gap-3 border-b border-slate-100 px-4 py-3 text-xs font-semibold uppercase tracking-normal text-slate-500">
            <span>Service</span>
            <span>Events</span>
            <span>Logs</span>
            <span>Errors</span>
            <span>Error %</span>
            <span className="text-right">Avg latency</span>
          </div>
          {(metrics?.services.length ?? 0) === 0 ? (
            <p className="px-4 py-6 text-sm text-slate-500">
              {isLoading ? "Loading services" : "No service metrics yet"}
            </p>
          ) : (
            <div className="min-w-[42rem] divide-y divide-slate-100">
              {metrics?.services.map((service) => (
                <article
                  className="grid grid-cols-[1fr_5rem_5rem_5rem_6rem_7rem] items-center gap-3 px-4 py-3 text-sm"
                  key={service.service}
                >
                  <span className="truncate font-semibold text-slate-900">{service.service}</span>
                  <span className="font-mono text-slate-700">{service.events}</span>
                  <span className="font-mono text-slate-700">{service.logs}</span>
                  <span className="font-mono text-slate-700">{service.errors}</span>
                  <span className="font-mono text-slate-700">{service.errorRate}%</span>
                  <span className="text-right font-mono text-slate-700">
                    {formatMs(service.avgLatencyMs)}
                  </span>
                </article>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-md border border-slate-200 bg-white">
          <div className="border-b border-slate-100 px-4 py-3">
            <h2 className="text-sm font-semibold uppercase tracking-normal text-slate-500">
              Metric samples
            </h2>
          </div>
          {(metrics?.metricSamples.length ?? 0) === 0 ? (
            <p className="px-4 py-6 text-sm text-slate-500">
              {isLoading ? "Loading metrics" : "No metric samples yet"}
            </p>
          ) : (
            <div className="divide-y divide-slate-100">
              {metrics?.metricSamples
                .slice()
                .reverse()
                .map((sample) => (
                  <article className="px-4 py-3" key={sample.id}>
                    <p className="truncate text-sm font-semibold text-slate-900">{sample.name}</p>
                    <p className="mt-1 text-xs text-slate-500">{sample.source}</p>
                    <div className="mt-2 flex items-center justify-between gap-3">
                      <span className="font-mono text-sm text-slate-700">
                        {formatMetricValue(sample.value, sample.unit)}
                      </span>
                      <span className="text-xs text-slate-500">
                        {new Date(sample.observedAt).toLocaleTimeString()}
                      </span>
                    </div>
                  </article>
                ))}
            </div>
          )}
        </div>
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

function formatMs(value: number | null): string {
  return value === null ? "-" : `${Math.round(value)}ms`;
}

function formatMetricValue(value: number, unit: string | null): string {
  return unit === null ? String(value) : `${value}${unit}`;
}
