import {
  Activity,
  AlertTriangle,
  BarChart3,
  Check,
  Cpu,
  Database,
  Eye,
  Filter,
  Flame,
  HardDrive,
  Layers,
  LineChart as LineChartIcon,
  Loader2,
  Plus,
  Radio,
  RefreshCw,
  Search,
  Send,
  Server,
  ShieldAlert,
  SlidersHorizontal,
  Table as TableIcon,
  Trash2,
  X,
  Zap,
} from "lucide-react";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import {
  createMetricDefinition,
  deleteMetricDefinition,
  getCardinalityGuardrails,
  getServiceMetricsSummaries,
  listMetricDefinitions,
  queryMetricSeries,
  type CardinalityGuardrailStatus,
  type MetricDefinition,
  type MetricRollupAggregation,
  type MetricTimeBucket,
  type MetricTimeSeriesResult,
  type MetricType,
  type ServiceMetricSummary,
} from "@/features/metrics-platform/api";
import { getMetricSummary, type MetricSummary } from "@/features/dashboards/api";
import { ingestMetric } from "@/features/ingestion/api";
import { getApiErrorMessage } from "@/lib/api-client";
import { createPulseOpsSocket, joinProjectRoom, leaveProjectRoom } from "@/lib/socket-client";
import { cn } from "@/lib/utils";
import { useDashboardContext } from "./DashboardLayout";

const rollupOptions: Array<{ label: string; value: MetricRollupAggregation }> = [
  { label: "Average (Avg)", value: "avg" },
  { label: "Sum Total", value: "sum" },
  { label: "P50 Median", value: "p50" },
  { label: "P95 Tail Latency", value: "p95" },
  { label: "P99 Critical Tail", value: "p99" },
  { label: "Maximum", value: "max" },
  { label: "Minimum", value: "min" },
  { label: "Event Count", value: "count" },
];

const bucketOptions: Array<{ label: string; value: MetricTimeBucket }> = [
  { label: "10 seconds", value: "10s" },
  { label: "1 minute", value: "1m" },
  { label: "5 minutes", value: "5m" },
  { label: "15 minutes", value: "15m" },
  { label: "1 hour", value: "1h" },
];

const groupByOptions = [
  { label: "None (Overall)", value: "" },
  { label: "Service", value: "service" },
  { label: "Endpoint", value: "endpoint" },
  { label: "HTTP Status Code", value: "statusCode" },
  { label: "Host / Node", value: "host" },
];

const SERIES_COLORS = ["#10b981", "#06b6d4", "#f59e0b", "#8b5cf6", "#ec4899", "#3b82f6"];

export function MetricsPage() {
  const { selectedEnvironment, selectedProject, selectedTimeRange } = useDashboardContext();
  const { notify } = useToast();

  const [activeTab, setActiveTab] = useState<"explorer" | "services" | "catalog">("explorer");
  const [metricDefs, setMetricDefs] = useState<MetricDefinition[]>([]);
  const [serviceSummaries, setServiceSummaries] = useState<ServiceMetricSummary[]>([]);
  const [guardrails, setGuardrails] = useState<CardinalityGuardrailStatus | null>(null);

  // Explorer State
  const [selectedMetric, setSelectedMetric] = useState<string>("http.server.requests");
  const [aggregation, setAggregation] = useState<MetricRollupAggregation>("avg");
  const [timeBucket, setTimeBucket] = useState<MetricTimeBucket>("1m");
  const [groupBy, setGroupBy] = useState<string>("service");
  const [seriesResults, setSeriesResults] = useState<MetricTimeSeriesResult[]>([]);
  const [chartType, setChartType] = useState<"area" | "line" | "bar">("area");
  const [isQuerying, setIsQuerying] = useState(false);

  // New Metric Modal State
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newMetricName, setNewMetricName] = useState("");
  const [newMetricType, setNewMetricType] = useState<MetricType>("counter");
  const [newMetricUnit, setNewMetricUnit] = useState("req/s");
  const [newMetricDesc, setNewMetricDesc] = useState("");
  const [newMetricTags, setNewMetricTags] = useState("service, environment, host");

  // Ingestion Test
  const [testApiKey, setTestApiKey] = useState("");
  const [isSendingTest, setIsSendingTest] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadData(): Promise<void> {
    if (!selectedProject) return;
    setIsLoading(true);
    setError(null);
    try {
      const [defs, summaries, guard] = await Promise.all([
        listMetricDefinitions(selectedProject.id),
        getServiceMetricsSummaries(selectedProject.id),
        getCardinalityGuardrails(selectedProject.id),
      ]);
      setMetricDefs(defs);
      setServiceSummaries(summaries);
      setGuardrails(guard);
      if (defs.length > 0 && !defs.some((d) => d.name === selectedMetric)) {
        setSelectedMetric(defs[0]!.name);
      }
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  }

  async function executeMetricQuery(): Promise<void> {
    if (!selectedProject || !selectedMetric) return;
    setIsQuerying(true);
    try {
      const series = await queryMetricSeries(selectedProject.id, {
        metricName: selectedMetric,
        aggregation,
        timeBucket,
        groupBy: groupBy || undefined,
      });
      setSeriesResults(series);
    } catch (err) {
      notify({
        title: "Query failed",
        description: getApiErrorMessage(err),
        variant: "error",
      });
    } finally {
      setIsQuerying(false);
    }
  }

  useEffect(() => {
    void loadData();
  }, [selectedProject?.id, selectedEnvironment]);

  useEffect(() => {
    void executeMetricQuery();
  }, [selectedProject?.id, selectedMetric, aggregation, timeBucket, groupBy]);

  // WebSocket Live Updates
  useEffect(() => {
    if (!selectedProject) return;
    const socket = createPulseOpsSocket();
    if (!socket) return;

    socket.on("connect", () => {
      void joinProjectRoom(socket, selectedProject.id, selectedEnvironment);
    });
    socket.on("event.created", (update) => {
      if (update.event.type === "metric") {
        void executeMetricQuery();
      }
    });
    socket.connect();

    return () => {
      leaveProjectRoom(socket, selectedProject.id, selectedEnvironment);
      socket.disconnect();
    };
  }, [selectedProject?.id, selectedEnvironment, selectedMetric, aggregation, timeBucket, groupBy]);

  const handleCreateMetric = async (e: FormEvent) => {
    e.preventDefault();
    if (!selectedProject || !newMetricName.trim()) return;

    try {
      const tags = newMetricTags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);

      const created = await createMetricDefinition(selectedProject.id, {
        name: newMetricName.trim(),
        type: newMetricType,
        unit: newMetricUnit.trim() || undefined,
        description: newMetricDesc.trim() || undefined,
        tagKeys: tags,
      });

      setMetricDefs((prev) => [...prev, created]);
      setSelectedMetric(created.name);
      setIsCreateModalOpen(false);
      setNewMetricName("");
      setNewMetricDesc("");
      notify({
        title: "Metric Registered",
        description: `Successfully added ${created.name} to the metric catalog.`,
        variant: "success",
      });
    } catch (err) {
      notify({
        title: "Creation failed",
        description: getApiErrorMessage(err),
        variant: "error",
      });
    }
  };

  const handleDeleteMetric = async (id: string, name: string) => {
    if (!selectedProject) return;
    try {
      await deleteMetricDefinition(selectedProject.id, id);
      setMetricDefs((prev) => prev.filter((d) => d.id !== id));
      notify({ title: "Metric Deleted", description: `Removed ${name}`, variant: "info" });
    } catch (err) {
      notify({ title: "Delete failed", description: getApiErrorMessage(err), variant: "error" });
    }
  };

  const handleSendTestMetric = async () => {
    if (!testApiKey.trim()) {
      notify({
        title: "API Key Required",
        description: "Paste an ingestion API key first.",
        variant: "error",
      });
      return;
    }

    setIsSendingTest(true);
    try {
      await ingestMetric(
        { apiKey: testApiKey.trim() },
        {
          source: "po-api-gateway",
          name: selectedMetric || "http.server.duration_ms",
          value: Number((25 + Math.random() * 150).toFixed(2)),
          unit: "ms",
          attributes: {
            environment: selectedEnvironment,
            service: "po-api-gateway",
            endpoint: "/v1/checkout",
            statusCode: "200",
          },
        },
      );
      notify({
        title: "Test Ingested",
        description: `Dispatched sample metric point for ${selectedMetric}.`,
        variant: "success",
      });
      void executeMetricQuery();
    } catch (err) {
      notify({ title: "Ingestion failed", description: getApiErrorMessage(err), variant: "error" });
    } finally {
      setIsSendingTest(false);
    }
  };

  // Format chart data
  const chartData = useMemo(() => {
    if (seriesResults.length === 0) return [];
    const timestampMap = new Map<string, Record<string, number | string>>();

    seriesResults.forEach((series, idx) => {
      const seriesKey = groupBy ? `${series.tags[groupBy] || `Series ${idx + 1}`}` : "value";

      series.points.forEach((pt) => {
        const timeLabel = new Date(pt.timestamp).toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        });

        const current = timestampMap.get(pt.timestamp) || {
          timestamp: timeLabel,
          fullTime: pt.timestamp,
        };
        current[seriesKey] = pt.value;
        timestampMap.set(pt.timestamp, current);
      });
    });

    return Array.from(timestampMap.values()).sort((a, b) =>
      String(a.fullTime).localeCompare(String(b.fullTime)),
    );
  }, [seriesResults, groupBy]);

  const seriesKeys = useMemo(() => {
    if (seriesResults.length === 0) return ["value"];
    if (!groupBy) return ["value"];
    return seriesResults.map((s, idx) => s.tags[groupBy] || `Series ${idx + 1}`);
  }, [seriesResults, groupBy]);

  const selectedMetricDef = useMemo(
    () => metricDefs.find((d) => d.name === selectedMetric),
    [metricDefs, selectedMetric],
  );

  return (
    <main className="mx-auto flex max-w-7xl flex-col gap-6">
      <header className="flex flex-col gap-3 border-b border-zinc-800 pb-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-emerald-400">
              {selectedProject?.name ?? "No project selected"} / {selectedEnvironment}
            </span>
            <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Metrics Platform Active
            </span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white mt-1">
            Metrics & Time-Series Platform
          </h1>
          <p className="mt-1 max-w-3xl text-xs text-zinc-400">
            Multi-dimensional time-bucket rollups (P50, P95, P99, Avg, Sum), cardinality guardrails,
            and service performance matrix.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Ingestion Test Pill */}
          <div className="flex items-center gap-1.5 bg-zinc-900 border border-zinc-800 p-1 rounded-xl">
            <Input
              type="password"
              placeholder="Ingestion API key..."
              value={testApiKey}
              onChange={(e) => setTestApiKey(e.target.value)}
              className="h-7 w-36 bg-zinc-950 border-zinc-800 text-[11px]"
            />
            <Button
              onClick={() => void handleSendTestMetric()}
              disabled={isSendingTest}
              className="text-xs h-7 px-2.5 bg-emerald-600 hover:bg-emerald-500 text-white gap-1"
            >
              {isSendingTest ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <Send className="w-3 h-3" />
              )}
              Send Metric
            </Button>
          </div>

          <Button onClick={() => void loadData()} variant="outline" className="text-xs gap-1.5 h-9">
            <RefreshCw className="h-3.5 w-3.5" />
            Refresh
          </Button>

          <Button
            onClick={() => setIsCreateModalOpen(true)}
            className="bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold gap-1.5 h-9 shadow-lg shadow-cyan-600/20"
          >
            <Plus className="h-3.5 w-3.5" />
            Define Metric
          </Button>
        </div>
      </header>

      {/* Navigation Tabs */}
      <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab("explorer")}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all",
              activeTab === "explorer"
                ? "bg-zinc-800 text-white border border-zinc-700 shadow-md"
                : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/60",
            )}
          >
            <LineChartIcon className="w-4 h-4 text-emerald-400" />
            Metric Explorer & Rollups
          </button>

          <button
            onClick={() => setActiveTab("services")}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all",
              activeTab === "services"
                ? "bg-zinc-800 text-white border border-zinc-700 shadow-md"
                : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/60",
            )}
          >
            <Server className="w-4 h-4 text-cyan-400" />
            Service Performance Matrix
          </button>

          <button
            onClick={() => setActiveTab("catalog")}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all",
              activeTab === "catalog"
                ? "bg-zinc-800 text-white border border-zinc-700 shadow-md"
                : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/60",
            )}
          >
            <Database className="w-4 h-4 text-purple-400" />
            Metric Catalog & Guardrails
          </button>
        </div>

        {guardrails && guardrails.highCardinalityViolations.length > 0 && (
          <div className="flex items-center gap-2 px-3 py-1 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-medium">
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>
              High Cardinality Warning on {guardrails.highCardinalityViolations[0]?.metricName}
            </span>
          </div>
        )}
      </div>

      {/* Tab 1: Metric Explorer */}
      {activeTab === "explorer" && (
        <div className="space-y-5">
          {/* Query Controls Toolbar */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3 bg-zinc-900/70 border border-zinc-800/80 p-3.5 rounded-2xl backdrop-blur-md shadow-xl">
            {/* Metric Selector */}
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-zinc-400 uppercase tracking-wide">
                Metric Name
              </label>
              <select
                value={selectedMetric}
                onChange={(e) => setSelectedMetric(e.target.value)}
                className="h-9 w-full rounded-lg border border-zinc-800 bg-zinc-950 px-2.5 text-xs text-white outline-none focus:ring-1 focus:ring-emerald-500"
              >
                {metricDefs.map((def) => (
                  <option key={def.id} value={def.name}>
                    {def.name} ({def.type})
                  </option>
                ))}
              </select>
            </div>

            {/* Rollup Aggregation */}
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-zinc-400 uppercase tracking-wide">
                Rollup Aggregation
              </label>
              <select
                value={aggregation}
                onChange={(e) => setAggregation(e.target.value as MetricRollupAggregation)}
                className="h-9 w-full rounded-lg border border-zinc-800 bg-zinc-950 px-2.5 text-xs text-white outline-none focus:ring-1 focus:ring-emerald-500"
              >
                {rollupOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Time Bucket Granularity */}
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-zinc-400 uppercase tracking-wide">
                Time Bucket Window
              </label>
              <select
                value={timeBucket}
                onChange={(e) => setTimeBucket(e.target.value as MetricTimeBucket)}
                className="h-9 w-full rounded-lg border border-zinc-800 bg-zinc-950 px-2.5 text-xs text-white outline-none focus:ring-1 focus:ring-emerald-500"
              >
                {bucketOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Group By Tag */}
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-zinc-400 uppercase tracking-wide">
                Group By Dimension
              </label>
              <select
                value={groupBy}
                onChange={(e) => setGroupBy(e.target.value)}
                className="h-9 w-full rounded-lg border border-zinc-800 bg-zinc-950 px-2.5 text-xs text-white outline-none focus:ring-1 focus:ring-emerald-500"
              >
                {groupByOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Chart Display Area */}
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5 backdrop-blur-md shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Activity className="w-4 h-4 text-emerald-400" />
                  {selectedMetric} • {aggregation.toUpperCase()} rollup ({timeBucket} buckets)
                </h3>
                <p className="text-xs text-zinc-500 mt-0.5">
                  {selectedMetricDef?.description || "Inbound time-series telemetry"} • Unit:{" "}
                  {selectedMetricDef?.unit || "val"}
                </p>
              </div>

              <div className="flex items-center gap-1 bg-zinc-950 border border-zinc-800 p-1 rounded-lg">
                <button
                  onClick={() => setChartType("area")}
                  className={cn(
                    "px-2.5 py-1 rounded text-xs font-semibold transition-all",
                    chartType === "area"
                      ? "bg-zinc-800 text-emerald-400"
                      : "text-zinc-500 hover:text-zinc-300",
                  )}
                >
                  Area
                </button>
                <button
                  onClick={() => setChartType("line")}
                  className={cn(
                    "px-2.5 py-1 rounded text-xs font-semibold transition-all",
                    chartType === "line"
                      ? "bg-zinc-800 text-cyan-400"
                      : "text-zinc-500 hover:text-zinc-300",
                  )}
                >
                  Line
                </button>
                <button
                  onClick={() => setChartType("bar")}
                  className={cn(
                    "px-2.5 py-1 rounded text-xs font-semibold transition-all",
                    chartType === "bar"
                      ? "bg-zinc-800 text-purple-400"
                      : "text-zinc-500 hover:text-zinc-300",
                  )}
                >
                  Bar
                </button>
              </div>
            </div>

            <div className="h-80 w-full pt-4">
              {isQuerying ? (
                <div className="h-full flex items-center justify-center">
                  <Loader2 className="w-8 h-8 animate-spin text-emerald-400" />
                </div>
              ) : chartData.length === 0 ? (
                <div className="h-full flex items-center justify-center text-xs text-zinc-500">
                  No time-series data available for the selected query parameters.
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  {chartType === "area" ? (
                    <AreaChart data={chartData}>
                      <defs>
                        {seriesKeys.map((key, idx) => (
                          <linearGradient
                            key={key}
                            id={`color_${key.replace(/[^a-zA-Z0-9]/g, "_")}`}
                            x1="0"
                            y1="0"
                            x2="0"
                            y2="1"
                          >
                            <stop
                              offset="5%"
                              stopColor={SERIES_COLORS[idx % SERIES_COLORS.length]}
                              stopOpacity={0.4}
                            />
                            <stop
                              offset="95%"
                              stopColor={SERIES_COLORS[idx % SERIES_COLORS.length]}
                              stopOpacity={0.0}
                            />
                          </linearGradient>
                        ))}
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                      <XAxis dataKey="timestamp" stroke="#71717a" fontSize={10} />
                      <YAxis stroke="#71717a" fontSize={10} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "#09090b",
                          borderColor: "#27272a",
                          borderRadius: "0.75rem",
                          fontSize: "11px",
                          color: "#fff",
                        }}
                      />
                      <Legend wrapperStyle={{ fontSize: "11px", paddingTop: "8px" }} />
                      {seriesKeys.map((key, idx) => (
                        <Area
                          key={key}
                          type="monotone"
                          dataKey={key}
                          stroke={SERIES_COLORS[idx % SERIES_COLORS.length]}
                          fill={`url(#color_${key.replace(/[^a-zA-Z0-9]/g, "_")})`}
                          strokeWidth={2}
                        />
                      ))}
                    </AreaChart>
                  ) : chartType === "line" ? (
                    <LineChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                      <XAxis dataKey="timestamp" stroke="#71717a" fontSize={10} />
                      <YAxis stroke="#71717a" fontSize={10} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "#09090b",
                          borderColor: "#27272a",
                          borderRadius: "0.75rem",
                          fontSize: "11px",
                          color: "#fff",
                        }}
                      />
                      <Legend wrapperStyle={{ fontSize: "11px", paddingTop: "8px" }} />
                      {seriesKeys.map((key, idx) => (
                        <Line
                          key={key}
                          type="monotone"
                          dataKey={key}
                          stroke={SERIES_COLORS[idx % SERIES_COLORS.length]}
                          strokeWidth={2}
                          dot={false}
                        />
                      ))}
                    </LineChart>
                  ) : (
                    <BarChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                      <XAxis dataKey="timestamp" stroke="#71717a" fontSize={10} />
                      <YAxis stroke="#71717a" fontSize={10} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "#09090b",
                          borderColor: "#27272a",
                          borderRadius: "0.75rem",
                          fontSize: "11px",
                          color: "#fff",
                        }}
                      />
                      <Legend wrapperStyle={{ fontSize: "11px", paddingTop: "8px" }} />
                      {seriesKeys.map((key, idx) => (
                        <Bar
                          key={key}
                          dataKey={key}
                          fill={SERIES_COLORS[idx % SERIES_COLORS.length]}
                          radius={[4, 4, 0, 0]}
                        />
                      ))}
                    </BarChart>
                  )}
                </ResponsiveContainer>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Service Performance Matrix */}
      {activeTab === "services" && (
        <div className="space-y-4">
          <div className="overflow-x-auto rounded-2xl border border-zinc-800 bg-zinc-900/60 backdrop-blur-md shadow-2xl">
            <table className="w-full text-left text-xs text-zinc-300">
              <thead className="border-b border-zinc-800 bg-zinc-950/60 text-[11px] font-bold uppercase tracking-wider text-zinc-500">
                <tr>
                  <th className="px-5 py-3.5">Service Name</th>
                  <th className="px-4 py-3.5">Health Status</th>
                  <th className="px-4 py-3.5">Throughput (RPS)</th>
                  <th className="px-4 py-3.5">Error Rate</th>
                  <th className="px-4 py-3.5">P95 Latency</th>
                  <th className="px-4 py-3.5">CPU Usage</th>
                  <th className="px-4 py-3.5">Memory</th>
                  <th className="px-4 py-3.5 text-right">Infra Units</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-850">
                {serviceSummaries.map((s) => (
                  <tr key={s.serviceName} className="hover:bg-zinc-800/30 transition-colors">
                    <td className="px-5 py-3.5 font-bold text-white font-mono flex items-center gap-2">
                      <Server className="w-3.5 h-3.5 text-cyan-400" />
                      {s.serviceName}
                    </td>
                    <td className="px-4 py-3.5">
                      <span
                        className={cn(
                          "px-2 py-0.5 rounded-full text-[10px] font-bold uppercase border",
                          s.status === "healthy"
                            ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                            : s.status === "degraded"
                              ? "bg-amber-500/10 border-amber-500/30 text-amber-400"
                              : "bg-rose-500/10 border-rose-500/30 text-rose-400",
                        )}
                      >
                        {s.status}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 font-mono font-medium text-white">
                      {s.throughputRps.toFixed(1)} req/s
                    </td>
                    <td className="px-4 py-3.5 font-mono">
                      <span
                        className={cn(
                          s.errorRatePercent > 1.0 ? "text-rose-400 font-bold" : "text-zinc-300",
                        )}
                      >
                        {s.errorRatePercent.toFixed(2)}%
                      </span>
                    </td>
                    <td className="px-4 py-3.5 font-mono font-medium text-white">
                      {s.p95LatencyMs.toFixed(1)} ms
                    </td>
                    <td className="px-4 py-3.5 font-mono">
                      <div className="flex items-center gap-2">
                        <div className="w-16 h-1.5 rounded-full bg-zinc-800 overflow-hidden">
                          <div
                            className={cn(
                              "h-full rounded-full",
                              s.cpuUsagePercent > 70 ? "bg-rose-500" : "bg-emerald-400",
                            )}
                            style={{ width: `${s.cpuUsagePercent}%` }}
                          />
                        </div>
                        <span>{s.cpuUsagePercent.toFixed(1)}%</span>
                      </div>
                    </td>
                    <td className="px-4 py-3.5 font-mono text-zinc-300">{s.memoryUsageMb} MB</td>
                    <td className="px-4 py-3.5 text-right font-mono text-zinc-500">
                      {s.hostCount} hosts • {s.containerCount} cont
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 3: Metric Catalog & Guardrails */}
      {activeTab === "catalog" && (
        <div className="space-y-6">
          {/* Guardrails Card */}
          {guardrails && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 rounded-2xl bg-zinc-900/60 border border-zinc-800 backdrop-blur-md">
                <div className="flex items-center gap-2 text-emerald-400">
                  <Database className="w-4 h-4" />
                  <h4 className="text-xs font-bold uppercase tracking-wider">Registered Metrics</h4>
                </div>
                <p className="text-2xl font-bold text-white mt-2 font-mono">
                  {guardrails.totalMetrics}
                </p>
                <p className="text-[11px] text-zinc-500 mt-1">Catalog metric types</p>
              </div>

              <div className="p-4 rounded-2xl bg-zinc-900/60 border border-zinc-800 backdrop-blur-md">
                <div className="flex items-center gap-2 text-cyan-400">
                  <Layers className="w-4 h-4" />
                  <h4 className="text-xs font-bold uppercase tracking-wider">
                    Active Dimension Tags
                  </h4>
                </div>
                <p className="text-2xl font-bold text-white mt-2 font-mono">
                  {guardrails.activeTagsCount}
                </p>
                <p className="text-[11px] text-zinc-500 mt-1">Indexed tag dimensions</p>
              </div>

              <div className="p-4 rounded-2xl bg-zinc-900/60 border border-zinc-800 backdrop-blur-md">
                <div className="flex items-center gap-2 text-amber-400">
                  <ShieldAlert className="w-4 h-4" />
                  <h4 className="text-xs font-bold uppercase tracking-wider">
                    Cardinality Guardrails
                  </h4>
                </div>
                <p className="text-2xl font-bold text-white mt-2 font-mono">
                  {guardrails.highCardinalityViolations.length} Warnings
                </p>
                <p className="text-[11px] text-zinc-500 mt-1">
                  Tag key limits enforced (max 1000/hr)
                </p>
              </div>
            </div>
          )}

          {/* Metric Catalog Table */}
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 backdrop-blur-md shadow-2xl overflow-hidden">
            <div className="p-4 border-b border-zinc-800 flex items-center justify-between">
              <h3 className="text-sm font-bold text-white">Metric Catalog Definitions</h3>
              <span className="text-xs text-zinc-500">{metricDefs.length} metrics defined</span>
            </div>

            <div className="divide-y divide-zinc-850">
              {metricDefs.map((def) => (
                <div
                  key={def.id}
                  className="p-4 flex items-center justify-between hover:bg-zinc-800/20 transition-colors"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-white font-mono">{def.name}</span>
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 uppercase">
                        {def.type}
                      </span>
                      {def.unit && (
                        <span className="px-1.5 py-0.2 rounded text-[10px] bg-zinc-800 text-zinc-400 font-mono">
                          unit: {def.unit}
                        </span>
                      )}
                    </div>
                    {def.description && <p className="text-xs text-zinc-400">{def.description}</p>}
                    <div className="flex flex-wrap items-center gap-1 pt-1">
                      <span className="text-[10px] text-zinc-500 font-semibold uppercase mr-1">
                        Tags:
                      </span>
                      {def.tagKeys.map((tag) => (
                        <span
                          key={tag}
                          className="px-1.5 py-0.5 rounded text-[10px] bg-zinc-800/80 text-zinc-300 font-mono"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="text-right text-[11px] text-zinc-500 font-mono">
                      <p>Limit: {def.cardinalityLimit}</p>
                      <p>Retention: {def.retentionDays}d</p>
                    </div>
                    {def.projectId !== "default" && (
                      <Button
                        onClick={() => void handleDeleteMetric(def.id, def.name)}
                        variant="ghost"
                        className="text-rose-400 hover:text-rose-300 h-8 px-2"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Modal: Define Custom Metric */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-900 p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Plus className="w-4 h-4 text-cyan-400" />
                Define Catalog Metric
              </h3>
              <button
                onClick={() => setIsCreateModalOpen(false)}
                className="text-zinc-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateMetric} className="space-y-3">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-zinc-300">Metric Name</label>
                <Input
                  required
                  placeholder="e.g. app.checkout.amount"
                  value={newMetricName}
                  onChange={(e) => setNewMetricName(e.target.value)}
                  className="bg-zinc-950 border-zinc-800 text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-zinc-300">Metric Type</label>
                  <select
                    value={newMetricType}
                    onChange={(e) => setNewMetricType(e.target.value as MetricType)}
                    className="h-10 w-full rounded-md border border-zinc-800 bg-zinc-950 px-3 text-xs text-white"
                  >
                    <option value="counter">Counter</option>
                    <option value="gauge">Gauge</option>
                    <option value="histogram">Histogram</option>
                    <option value="summary">Summary</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-zinc-300">Unit</label>
                  <Input
                    placeholder="e.g. ms, req/s, %, MB"
                    value={newMetricUnit}
                    onChange={(e) => setNewMetricUnit(e.target.value)}
                    className="bg-zinc-950 border-zinc-800 text-xs"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-zinc-300">Description</label>
                <Input
                  placeholder="What this metric measures..."
                  value={newMetricDesc}
                  onChange={(e) => setNewMetricDesc(e.target.value)}
                  className="bg-zinc-950 border-zinc-800 text-xs"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-zinc-300">
                  Indexed Tag Keys (comma-separated)
                </label>
                <Input
                  placeholder="service, environment, region, host"
                  value={newMetricTags}
                  onChange={(e) => setNewMetricTags(e.target.value)}
                  className="bg-zinc-950 border-zinc-800 text-xs"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-zinc-800">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="text-xs text-zinc-400"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  className="bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-medium"
                >
                  Register Metric
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}
