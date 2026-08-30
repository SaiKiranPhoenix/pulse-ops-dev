import {
  Activity,
  AlertTriangle,
  BarChart3,
  Check,
  Download,
  FileSpreadsheet,
  Filter,
  Loader2,
  RefreshCw,
  Search,
  Share2,
  Terminal,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import {
  executeQueryExplorer,
  type QueryExplorerRequest,
  type QueryExplorerResponse,
} from "@/features/custom-dashboards/api";
import { getApiErrorMessage } from "@/lib/api-client";
import { useDashboardContext } from "./DashboardLayout";

export function QueryExplorerPage() {
  const { selectedEnvironment, selectedProject } = useDashboardContext();
  const { notify } = useToast();

  const [queryType, setQueryType] = useState<"logs" | "metrics" | "errors">("logs");
  const [serviceName, setServiceName] = useState<string>("");
  const [severity, setSeverity] = useState<string>("");
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [timeRangeMinutes, setTimeRangeMinutes] = useState<number>(60);
  const [isLoading, setIsLoading] = useState(false);
  const [response, setResponse] = useState<QueryExplorerResponse | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);

  const runQuery = async () => {
    if (!selectedProject) return;
    setIsLoading(true);
    try {
      const payload: QueryExplorerRequest = {
        queryType,
        serviceName: serviceName || undefined,
        environment: selectedEnvironment || undefined,
        severity: severity || undefined,
        searchTerm: searchTerm.trim() || undefined,
        timeRangeMinutes,
        limit: 50,
      };
      const data = await executeQueryExplorer(selectedProject.id, payload);
      setResponse(data);
    } catch (err) {
      notify({
        title: "Query execution failed",
        description: getApiErrorMessage(err),
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void runQuery();
  }, [selectedProject?.id, queryType, timeRangeMinutes, selectedEnvironment]);

  const handleShareLink = () => {
    const params = new URLSearchParams({
      type: queryType,
      time: timeRangeMinutes.toString(),
      search: searchTerm,
      service: serviceName,
    });
    const shareUrl = `${window.location.origin}${window.location.pathname}?${params.toString()}`;
    void navigator.clipboard.writeText(shareUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
    notify({ title: "Link Copied", description: "Query state link copied to clipboard." });
  };

  const handleExport = (format: "csv" | "json") => {
    if (!response || response.records.length === 0) return;

    let content = "";
    let mimeType = "";
    let ext = "";

    if (format === "csv") {
      const firstRow = response.records[0];
      if (!firstRow) return;
      const headers = Object.keys(firstRow).join(",");
      const rows = response.records
        .map((row) =>
          Object.values(row)
            .map((v) => `"${String(v).replace(/"/g, '""')}"`)
            .join(","),
        )
        .join("\n");
      content = `${headers}\n${rows}`;
      mimeType = "text/csv";
      ext = "csv";
    } else {
      content = JSON.stringify(response.records, null, 2);
      mimeType = "application/json";
      ext = "json";
    }

    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `query_export_${queryType}_${Date.now()}.${ext}`;
    a.click();
    URL.revokeObjectURL(url);
    notify({ title: "Export Started", description: `Downloaded ${response.records.length} records as ${ext.toUpperCase()}` });
  };

  if (!selectedProject) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-6">
        <Filter className="w-12 h-12 text-zinc-600 mb-3" />
        <h2 className="text-lg font-semibold text-zinc-200">Select a Project</h2>
        <p className="text-sm text-zinc-500 max-w-sm">
          Please select a project to query logs, metrics, and error telemetry.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto p-4 sm:p-6 pb-20">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-800/80 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2.5">
              <Search className="w-6 h-6 text-emerald-400" />
              Query Explorer
            </h1>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              Telemetry Studio
            </span>
          </div>
          <p className="text-xs text-zinc-400 mt-1">
            Perform multi-source telemetry investigations across logs, metrics, and errors for {selectedProject.name}.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            onClick={handleShareLink}
            variant="outline"
            size="sm"
            className="border-zinc-700 text-xs text-zinc-300 hover:text-white gap-1.5"
          >
            {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Share2 className="w-3.5 h-3.5" />}
            {copiedLink ? "Copied" : "Share Query"}
          </Button>

          <Button
            onClick={() => void runQuery()}
            size="sm"
            className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium gap-1.5 shadow-lg shadow-emerald-950/40"
          >
            {isLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
            Run Query
          </Button>
        </div>
      </div>

      {/* Query Filters Bar */}
      <div className="bg-zinc-900/80 border border-zinc-800/80 p-4 rounded-2xl backdrop-blur-md space-y-4 shadow-xl">
        {/* Source Toggle & Time Range */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-800/60 pb-3">
          <div className="flex items-center gap-1.5 bg-zinc-950 p-1 rounded-xl border border-zinc-800">
            {[
              { type: "logs", label: "Logs", icon: Terminal },
              { type: "metrics", label: "Metrics", icon: BarChart3 },
              { type: "errors", label: "Errors", icon: AlertTriangle },
            ].map((tab) => {
              const Icon = tab.icon;
              const isSelected = queryType === tab.type;
              return (
                <button
                  key={tab.type}
                  onClick={() => setQueryType(tab.type as "logs" | "metrics" | "errors")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-all ${
                    isSelected
                      ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 shadow-sm"
                      : "text-zinc-400 hover:text-zinc-200"
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {tab.label}
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-1.5 bg-zinc-950 p-1 rounded-xl border border-zinc-800">
            {[
              { label: "15m", val: 15 },
              { label: "1h", val: 60 },
              { label: "6h", val: 360 },
              { label: "24h", val: 1440 },
              { label: "7d", val: 10080 },
            ].map((t) => (
              <button
                key={t.val}
                onClick={() => setTimeRangeMinutes(t.val)}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
                  timeRangeMinutes === t.val
                    ? "bg-zinc-800 text-white font-semibold"
                    : "text-zinc-500 hover:text-zinc-300"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Structured Filters */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="space-y-1">
            <label className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">
              Search Term / Regex
            </label>
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-3 top-3 text-zinc-500" />
              <Input
                placeholder="e.g. status:500 OR timeout"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && void runQuery()}
                className="bg-zinc-950 border-zinc-800 pl-8.5 text-xs"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">
              Service
            </label>
            <select
              value={serviceName}
              onChange={(e) => setServiceName(e.target.value)}
              className="w-full h-9 rounded-md bg-zinc-950 border border-zinc-800 px-3 text-xs text-zinc-200 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            >
              <option value="">All Services</option>
              <option value="po-api-gateway">po-api-gateway</option>
              <option value="po-ingestion-service">po-ingestion-service</option>
              <option value="po-vault-service">po-vault-service</option>
              <option value="po-event-workers">po-event-workers</option>
              <option value="sample-express-app">sample-express-app</option>
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">
              Severity / Level
            </label>
            <select
              value={severity}
              onChange={(e) => setSeverity(e.target.value)}
              className="w-full h-9 rounded-md bg-zinc-950 border border-zinc-800 px-3 text-xs text-zinc-200 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            >
              <option value="">All Severities</option>
              <option value="info">Info / Debug</option>
              <option value="warn">Warning</option>
              <option value="error">Error</option>
              <option value="critical">Critical</option>
            </select>
          </div>
        </div>
      </div>

      {/* Results Section */}
      {isLoading ? (
        <div className="flex items-center justify-center p-20">
          <Loader2 className="w-8 h-8 animate-spin text-emerald-400" />
        </div>
      ) : !response ? (
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-12 text-center text-zinc-500 text-xs">
          Run a query to investigate telemetry data.
        </div>
      ) : (
        <div className="space-y-6">
          {/* Summary KPIs */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="rounded-xl border border-zinc-800/80 bg-zinc-900/50 p-4 backdrop-blur-md">
              <span className="text-[11px] text-zinc-400 font-medium uppercase">Total Matches</span>
              <div className="text-2xl font-extrabold text-white mt-1">
                {response.totalCount.toLocaleString()}
              </div>
              <span className="text-[10px] text-zinc-500">Across {timeRangeMinutes}m window</span>
            </div>

            <div className="rounded-xl border border-zinc-800/80 bg-zinc-900/50 p-4 backdrop-blur-md">
              <span className="text-[11px] text-zinc-400 font-medium uppercase">Queried Source</span>
              <div className="text-2xl font-extrabold text-emerald-400 mt-1 capitalize">
                {queryType}
              </div>
              <span className="text-[10px] text-zinc-500">{selectedEnvironment} environment</span>
            </div>

            <div className="rounded-xl border border-zinc-800/80 bg-zinc-900/50 p-4 backdrop-blur-md flex flex-col justify-between">
              <span className="text-[11px] text-zinc-400 font-medium uppercase">Export Dataset</span>
              <div className="flex items-center gap-2 mt-2">
                <Button
                  onClick={() => handleExport("csv")}
                  size="sm"
                  variant="outline"
                  className="flex-1 border-zinc-700 text-xs text-zinc-300 hover:text-white gap-1.5"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
                  CSV
                </Button>
                <Button
                  onClick={() => handleExport("json")}
                  size="sm"
                  variant="outline"
                  className="flex-1 border-zinc-700 text-xs text-zinc-300 hover:text-white gap-1.5"
                >
                  <Download className="w-3.5 h-3.5 text-cyan-400" />
                  JSON
                </Button>
              </div>
            </div>
          </div>

          {/* Density Histogram Chart */}
          <div className="rounded-2xl border border-zinc-800/80 bg-zinc-900/60 p-5 shadow-xl backdrop-blur-md space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold text-zinc-200 tracking-wide flex items-center gap-2">
                <Activity className="w-4 h-4 text-emerald-400" />
                Event Density Timeline
              </h3>
              <span className="text-[10px] text-zinc-500 font-mono">
                Updated {new Date(response.queriedAt).toLocaleTimeString()}
              </span>
            </div>

            <div className="h-24 w-full flex items-end gap-1 pt-2">
              {response.timeseries.map((pt, idx) => (
                <div
                  key={idx}
                  className="flex-1 bg-gradient-to-t from-emerald-500/20 to-emerald-400/80 rounded-t hover:brightness-125 transition-all"
                  style={{ height: `${Math.min(100, Math.max(15, (pt.value / 60) * 100))}%` }}
                  title={`${new Date(pt.timestamp).toLocaleTimeString()}: ${pt.value} events`}
                />
              ))}
            </div>
          </div>

          {/* Records Table */}
          <div className="rounded-2xl border border-zinc-800/80 bg-zinc-900/60 p-5 shadow-xl backdrop-blur-md space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold text-zinc-200 tracking-wide">
                Queried Records ({response.records.length} of {response.totalCount})
              </h3>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-zinc-800 text-zinc-400 font-medium">
                    <th className="pb-3 pr-4">Timestamp</th>
                    <th className="pb-3 pr-4">Service</th>
                    <th className="pb-3 pr-4">Level / Status</th>
                    <th className="pb-3">Message / Payload</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/60 font-mono">
                  {response.records.map((rec, i) => {
                    const time = String(rec.timestamp || new Date().toISOString());
                    const srv = String(rec.service || "unknown");
                    const lvl = String(rec.level || rec.severity || rec.status || "info");
                    const msg = String(rec.message || rec.metricName || JSON.stringify(rec));

                    const badgeClass =
                      lvl === "critical" || lvl === "error"
                        ? "bg-rose-500/15 text-rose-400 border border-rose-500/30"
                        : lvl === "warn"
                          ? "bg-amber-500/15 text-amber-400 border border-amber-500/30"
                          : "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30";

                    return (
                      <tr key={i} className="hover:bg-zinc-800/30 transition-colors">
                        <td className="py-2.5 pr-4 text-zinc-500 whitespace-nowrap text-[11px]">
                          {new Date(time).toLocaleTimeString()}
                        </td>
                        <td className="py-2.5 pr-4 text-emerald-400 font-medium whitespace-nowrap text-[11px]">
                          {srv}
                        </td>
                        <td className="py-2.5 pr-4 whitespace-nowrap">
                          <span className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold ${badgeClass}`}>
                            {lvl}
                          </span>
                        </td>
                        <td className="py-2.5 text-zinc-300 text-[11px] truncate max-w-md" title={msg}>
                          {msg}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
