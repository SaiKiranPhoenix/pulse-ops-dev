import {
  Activity,
  AlertTriangle,
  BookOpen,
  Copy,
  Download,
  FileSpreadsheet,
  Layout,
  LayoutGrid,
  ListOrdered,
  Loader2,
  Plus,
  RefreshCw,
  Sparkles,
  Table as TableIcon,
  Terminal,
  Trash2,
  TrendingUp,
  X,
} from "lucide-react";
import { type FormEvent, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import {
  cloneCustomDashboard,
  createCustomDashboard,
  deleteCustomDashboard,
  listCustomDashboards,
  seedCustomDashboardTemplates,
  updateCustomDashboard,
  type CustomDashboard,
  type DashboardWidget,
  type DashboardWidgetType,
} from "@/features/custom-dashboards/api";
import { getApiErrorMessage } from "@/lib/api-client";
import { useDashboardContext } from "./DashboardLayout";

export function CustomDashboardsPage() {
  const { selectedProject } = useDashboardContext();
  const { notify } = useToast();

  const [dashboards, setDashboards] = useState<CustomDashboard[]>([]);
  const [activeDashboardId, setActiveDashboardId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreatingDashboard, setIsCreatingDashboard] = useState(false);
  const [isAddingWidget, setIsAddingWidget] = useState(false);
  const [isDeletingDashboard, setIsDeletingDashboard] = useState(false);

  // New dashboard form state
  const [newDashboardName, setNewDashboardName] = useState("");
  const [newDashboardDesc, setNewDashboardDesc] = useState("");
  const [newDashboardTags, setNewDashboardTags] = useState("custom,ops");

  // New widget form state
  const [widgetTitle, setWidgetTitle] = useState("");
  const [widgetType, setWidgetType] = useState<DashboardWidgetType>("timeseries");
  const [widgetWidth, setWidgetWidth] = useState<number>(6);
  const [widgetMetric, setWidgetMetric] = useState("http_requests_total");
  const [widgetUnit, setWidgetUnit] = useState("req/s");
  const [widgetFilter, setWidgetFilter] = useState("");
  const [widgetMarkdown, setWidgetMarkdown] = useState(
    "### On-Call Runbook\n- Check database connection pool\n- Rotate degraded worker pods",
  );

  const activeDashboard = useMemo(
    () => dashboards.find((d) => d.id === activeDashboardId) ?? dashboards[0] ?? null,
    [dashboards, activeDashboardId],
  );

  const loadDashboards = async () => {
    if (!selectedProject) return;
    setIsLoading(true);
    try {
      const data = await listCustomDashboards(selectedProject.id);
      setDashboards(data);
      if (data.length > 0 && !activeDashboardId) {
        setActiveDashboardId(data[0]?.id ?? null);
      }
    } catch (err) {
      notify({
        title: "Failed to load dashboards",
        description: getApiErrorMessage(err),
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadDashboards();
  }, [selectedProject?.id]);

  const handleCreateDashboard = async (e: FormEvent) => {
    e.preventDefault();
    if (!selectedProject || !newDashboardName.trim()) return;

    try {
      const created = await createCustomDashboard(selectedProject.id, {
        name: newDashboardName.trim(),
        description: newDashboardDesc.trim() || undefined,
        tags: newDashboardTags.split(",").map((t) => t.trim()).filter(Boolean),
        refreshIntervalSeconds: 30,
        widgets: [],
      });
      setDashboards((prev) => [created, ...prev]);
      setActiveDashboardId(created.id);
      setIsCreatingDashboard(false);
      setNewDashboardName("");
      setNewDashboardDesc("");
      notify({ title: "Dashboard Created", description: `"${created.name}" is ready.` });
    } catch (err) {
      notify({
        title: "Creation failed",
        description: getApiErrorMessage(err),
        variant: "destructive",
      });
    }
  };

  const handleAddWidget = async (e: FormEvent) => {
    e.preventDefault();
    if (!selectedProject || !activeDashboard || !widgetTitle.trim()) return;

    const newWidget: DashboardWidget = {
      id: `w_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      type: widgetType,
      title: widgetTitle.trim(),
      gridPos: { x: 0, y: 0, w: widgetWidth, h: 4 },
      config: {
        metricName: widgetType === "timeseries" || widgetType === "query_value" ? widgetMetric : undefined,
        unit: widgetType === "query_value" ? widgetUnit : undefined,
        queryFilter: widgetFilter.trim() || undefined,
        markdownContent: widgetType === "markdown" ? widgetMarkdown : undefined,
        chartType: "area",
      },
    };

    const updatedWidgets = [...activeDashboard.widgets, newWidget];
    try {
      const updated = await updateCustomDashboard(selectedProject.id, activeDashboard.id, {
        widgets: updatedWidgets,
      });
      setDashboards((prev) => prev.map((d) => (d.id === updated.id ? updated : d)));
      setIsAddingWidget(false);
      setWidgetTitle("");
      notify({ title: "Widget Added", description: `Added "${newWidget.title}" to dashboard.` });
    } catch (err) {
      notify({
        title: "Failed to add widget",
        description: getApiErrorMessage(err),
        variant: "destructive",
      });
    }
  };

  const handleRemoveWidget = async (widgetId: string) => {
    if (!selectedProject || !activeDashboard) return;
    const updatedWidgets = activeDashboard.widgets.filter((w) => w.id !== widgetId);
    try {
      const updated = await updateCustomDashboard(selectedProject.id, activeDashboard.id, {
        widgets: updatedWidgets,
      });
      setDashboards((prev) => prev.map((d) => (d.id === updated.id ? updated : d)));
      notify({ title: "Widget Removed" });
    } catch (err) {
      notify({
        title: "Failed to remove widget",
        description: getApiErrorMessage(err),
        variant: "destructive",
      });
    }
  };

  const handleCloneDashboard = async () => {
    if (!selectedProject || !activeDashboard) return;
    try {
      const cloned = await cloneCustomDashboard(selectedProject.id, activeDashboard.id);
      setDashboards((prev) => [cloned, ...prev]);
      setActiveDashboardId(cloned.id);
      notify({ title: "Dashboard Cloned", description: `Created copy "${cloned.name}".` });
    } catch (err) {
      notify({
        title: "Clone failed",
        description: getApiErrorMessage(err),
        variant: "destructive",
      });
    }
  };

  const handleDeleteDashboard = async () => {
    if (!selectedProject || !activeDashboard) return;
    try {
      await deleteCustomDashboard(selectedProject.id, activeDashboard.id);
      const remaining = dashboards.filter((d) => d.id !== activeDashboard.id);
      setDashboards(remaining);
      setActiveDashboardId(remaining[0]?.id ?? null);
      setIsDeletingDashboard(false);
      notify({ title: "Dashboard Deleted" });
    } catch (err) {
      notify({
        title: "Delete failed",
        description: getApiErrorMessage(err),
        variant: "destructive",
      });
    }
  };

  const handleSeedTemplates = async () => {
    if (!selectedProject) return;
    try {
      const res = await seedCustomDashboardTemplates(selectedProject.id);
      setDashboards((prev) => [...res.dashboards, ...prev]);
      if (res.dashboards[0]) {
        setActiveDashboardId(res.dashboards[0].id);
      }
      notify({
        title: "Templates Instantiated",
        description: `Created ${res.seededCount} production dashboard templates.`,
      });
    } catch (err) {
      notify({
        title: "Seed failed",
        description: getApiErrorMessage(err),
        variant: "destructive",
      });
    }
  };

  const exportTableData = (format: "csv" | "json", title: string) => {
    const sampleData = [
      { route: "/v1/auth/login", method: "POST", status: 200, count: 1420, p95_latency: "34ms" },
      { route: "/v1/ingest/events", method: "POST", status: 202, count: 18450, p95_latency: "12ms" },
      { route: "/v1/vault/secrets", method: "GET", status: 200, count: 520, p95_latency: "18ms" },
      { route: "/v1/checkout/pay", method: "POST", status: 500, count: 24, p95_latency: "450ms" },
    ];

    let content = "";
    let mimeType = "";
    let ext = "";

    if (format === "csv") {
      const headers = Object.keys(sampleData[0]!).join(",");
      const rows = sampleData.map((row) => Object.values(row).join(",")).join("\n");
      content = `${headers}\n${rows}`;
      mimeType = "text/csv";
      ext = "csv";
    } else {
      content = JSON.stringify(sampleData, null, 2);
      mimeType = "application/json";
      ext = "json";
    }

    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${title.toLowerCase().replace(/\s+/g, "_")}_export.${ext}`;
    a.click();
    URL.revokeObjectURL(url);
    notify({ title: "Export Started", description: `Downloaded ${title} as ${ext.toUpperCase()}` });
  };

  if (!selectedProject) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-6">
        <Layout className="w-12 h-12 text-zinc-600 mb-3" />
        <h2 className="text-lg font-semibold text-zinc-200">Select a Project</h2>
        <p className="text-sm text-zinc-500 max-w-sm">
          Please select a project to view and build custom operational dashboards.
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
              <LayoutGrid className="w-6 h-6 text-emerald-400" />
              Custom Dashboards
            </h1>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              Explorer Studio
            </span>
          </div>
          <p className="text-xs text-zinc-400 mt-1">
            Build, organize, and monitor custom multi-widget operational views for {selectedProject.name}.
          </p>
        </div>

        <div className="flex items-center flex-wrap gap-2">
          {dashboards.length === 0 && (
            <Button
              onClick={() => void handleSeedTemplates()}
              variant="outline"
              size="sm"
              className="border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10 gap-1.5"
            >
              <Sparkles className="w-3.5 h-3.5" />
              Seed Templates
            </Button>
          )}

          <Button
            onClick={() => setIsCreatingDashboard(true)}
            size="sm"
            className="bg-emerald-600 hover:bg-emerald-500 text-white font-medium gap-1.5 shadow-lg shadow-emerald-950/40"
          >
            <Plus className="w-4 h-4" />
            New Dashboard
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center p-20">
          <Loader2 className="w-8 h-8 animate-spin text-emerald-400" />
        </div>
      ) : dashboards.length === 0 ? (
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-12 text-center space-y-4">
          <Layout className="w-12 h-12 text-zinc-600 mx-auto" />
          <div className="space-y-1">
            <h3 className="text-base font-medium text-zinc-200">No Custom Dashboards Yet</h3>
            <p className="text-xs text-zinc-500 max-w-md mx-auto">
              Create your first customized operational board or seed pre-built templates for API Health, Queue Pipeline, and Incident Response.
            </p>
          </div>
          <div className="flex items-center justify-center gap-3 pt-2">
            <Button
              onClick={() => void handleSeedTemplates()}
              className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs gap-1.5"
            >
              <Sparkles className="w-3.5 h-3.5" />
              Seed Production Templates
            </Button>
            <Button
              onClick={() => setIsCreatingDashboard(true)}
              variant="outline"
              className="border-zinc-700 text-xs gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" />
              Create Empty Board
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Dashboard Switcher Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-zinc-900/80 border border-zinc-800/80 p-3 rounded-xl backdrop-blur-md">
            <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
              {dashboards.map((dash) => {
                const isActive = dash.id === activeDashboard?.id;
                return (
                  <button
                    key={dash.id}
                    onClick={() => setActiveDashboardId(dash.id)}
                    className={`px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap flex items-center gap-2 ${
                      isActive
                        ? "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 shadow-sm"
                        : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60"
                    }`}
                  >
                    <LayoutGrid className="w-3.5 h-3.5" />
                    {dash.name}
                    {dash.widgets.length > 0 && (
                      <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-zinc-800 text-zinc-400">
                        {dash.widgets.length}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {activeDashboard && (
              <div className="flex items-center gap-2 self-end sm:self-auto">
                <Button
                  onClick={() => setIsAddingWidget(true)}
                  size="sm"
                  variant="outline"
                  className="border-zinc-700 text-xs text-zinc-300 hover:text-white gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5 text-emerald-400" />
                  Add Widget
                </Button>
                <Button
                  onClick={() => void handleCloneDashboard()}
                  size="sm"
                  variant="ghost"
                  className="text-xs text-zinc-400 hover:text-white gap-1.5"
                  title="Clone Dashboard"
                >
                  <Copy className="w-3.5 h-3.5" />
                </Button>
                <Button
                  onClick={() => setIsDeletingDashboard(true)}
                  size="sm"
                  variant="ghost"
                  className="text-xs text-rose-400 hover:text-rose-300 hover:bg-rose-950/30 gap-1.5"
                  title="Delete Dashboard"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            )}
          </div>

          {/* Active Dashboard Info */}
          {activeDashboard && (
            <div className="flex items-center justify-between gap-4 text-xs text-zinc-400 px-1">
              <div className="flex items-center gap-3">
                {activeDashboard.description && <span>{activeDashboard.description}</span>}
                <div className="flex items-center gap-1.5">
                  {activeDashboard.tags.map((t) => (
                    <span
                      key={t}
                      className="px-2 py-0.5 rounded text-[10px] bg-zinc-800/80 text-zinc-400 border border-zinc-700/50"
                    >
                      #{t}
                    </span>
                  ))}
                </div>
              </div>
              <div className="flex items-center gap-2 text-[11px] text-zinc-500">
                <RefreshCw className="w-3 h-3 text-zinc-600" />
                <span>Auto-refresh: {activeDashboard.refreshIntervalSeconds}s</span>
              </div>
            </div>
          )}

          {/* Widgets Grid */}
          {activeDashboard && activeDashboard.widgets.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-zinc-800 p-12 text-center space-y-3">
              <Plus className="w-8 h-8 text-zinc-600 mx-auto" />
              <h4 className="text-sm font-medium text-zinc-300">Empty Dashboard</h4>
              <p className="text-xs text-zinc-500 max-w-sm mx-auto">
                Add metrics, timeseries charts, incident feeds, or runbook documentation widgets to this board.
              </p>
              <Button
                onClick={() => setIsAddingWidget(true)}
                size="sm"
                className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" />
                Add Your First Widget
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-12 gap-5">
              {activeDashboard?.widgets.map((widget) => {
                const colSpan =
                  widget.gridPos.w === 12
                    ? "col-span-12"
                    : widget.gridPos.w === 8
                      ? "col-span-12 lg:col-span-8"
                      : widget.gridPos.w === 4
                        ? "col-span-12 md:col-span-6 lg:col-span-4"
                        : "col-span-12 md:col-span-6";

                return (
                  <div
                    key={widget.id}
                    className={`${colSpan} rounded-2xl border border-zinc-800/80 bg-zinc-900/60 p-4.5 shadow-xl backdrop-blur-md flex flex-col justify-between group relative overflow-hidden`}
                  >
                    {/* Widget Header */}
                    <div className="flex items-center justify-between gap-2 border-b border-zinc-800/60 pb-3 mb-3">
                      <div className="flex items-center gap-2">
                        {widget.type === "timeseries" && (
                          <Activity className="w-4 h-4 text-emerald-400" />
                        )}
                        {widget.type === "query_value" && (
                          <TrendingUp className="w-4 h-4 text-cyan-400" />
                        )}
                        {widget.type === "toplist" && (
                          <ListOrdered className="w-4 h-4 text-amber-400" />
                        )}
                        {widget.type === "table" && (
                          <TableIcon className="w-4 h-4 text-purple-400" />
                        )}
                        {widget.type === "incident_list" && (
                          <AlertTriangle className="w-4 h-4 text-rose-400" />
                        )}
                        {widget.type === "log_stream" && (
                          <Terminal className="w-4 h-4 text-indigo-400" />
                        )}
                        {widget.type === "markdown" && (
                          <BookOpen className="w-4 h-4 text-blue-400" />
                        )}
                        <h4 className="text-xs font-semibold text-zinc-200 tracking-wide">
                          {widget.title}
                        </h4>
                      </div>

                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        {widget.type === "table" && (
                          <>
                            <button
                              onClick={() => exportTableData("csv", widget.title)}
                              className="p-1 rounded text-zinc-400 hover:text-white hover:bg-zinc-800"
                              title="Export CSV"
                            >
                              <FileSpreadsheet className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => exportTableData("json", widget.title)}
                              className="p-1 rounded text-zinc-400 hover:text-white hover:bg-zinc-800"
                              title="Export JSON"
                            >
                              <Download className="w-3.5 h-3.5" />
                            </button>
                          </>
                        )}
                        <button
                          onClick={() => void handleRemoveWidget(widget.id)}
                          className="p-1 rounded text-zinc-500 hover:text-rose-400 hover:bg-rose-950/30"
                          title="Remove Widget"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Widget Content Body */}
                    <div className="flex-1 py-1">
                      {/* 1. Single Stat Value */}
                      {widget.type === "query_value" && (
                        <div className="flex flex-col justify-center py-3">
                          <div className="flex items-baseline gap-2">
                            <span className="text-3xl font-extrabold text-white tracking-tight">
                              {widget.config.metricName?.includes("latency")
                                ? "24.5"
                                : widget.config.queryFilter?.includes("5xx")
                                  ? "0.02"
                                  : "1,420"}
                            </span>
                            <span className="text-xs font-semibold text-zinc-400 uppercase">
                              {widget.config.unit ?? "req/s"}
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5 mt-2 text-[11px] text-emerald-400 font-medium">
                            <TrendingUp className="w-3.5 h-3.5" />
                            <span>+4.2% vs previous 1h</span>
                          </div>
                        </div>
                      )}

                      {/* 2. Timeseries Area Chart Preview */}
                      {widget.type === "timeseries" && (
                        <div className="space-y-2">
                          <div className="h-28 w-full flex items-end gap-1.5 pt-4">
                            {[40, 65, 55, 80, 72, 90, 85, 95, 88, 100, 92, 110].map((val, idx) => (
                              <div
                                key={idx}
                                className="flex-1 bg-gradient-to-t from-emerald-500/20 to-emerald-400/80 rounded-t hover:brightness-125 transition-all"
                                style={{ height: `${(val / 110) * 100}%` }}
                                title={`Bucket ${idx + 1}: ${val} units`}
                              />
                            ))}
                          </div>
                          <div className="flex justify-between text-[10px] text-zinc-500 font-mono">
                            <span>-1 hour</span>
                            <span>now</span>
                          </div>
                        </div>
                      )}

                      {/* 3. Ranked Top-List */}
                      {widget.type === "toplist" && (
                        <div className="space-y-2.5">
                          {[
                            { name: "POST /v1/ingest/events", count: "12,450 req", pct: 85 },
                            { name: "GET /v1/vault/tokens", count: "3,200 req", pct: 45 },
                            { name: "POST /v1/auth/login", count: "1,890 req", pct: 30 },
                            { name: "GET /v1/incidents/active", count: "450 req", pct: 15 },
                          ].map((item, i) => (
                            <div key={i} className="space-y-1">
                              <div className="flex justify-between text-[11px]">
                                <span className="font-mono text-zinc-300 truncate max-w-[200px]">
                                  {item.name}
                                </span>
                                <span className="text-zinc-400 font-medium">{item.count}</span>
                              </div>
                              <div className="h-1.5 w-full bg-zinc-800 rounded-full overflow-hidden">
                                <div
                                  className="h-full bg-amber-400/80 rounded-full"
                                  style={{ width: `${item.pct}%` }}
                                />
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* 4. Tabular Data View */}
                      {widget.type === "table" && (
                        <div className="overflow-x-auto">
                          <table className="w-full text-left text-[11px]">
                            <thead>
                              <tr className="border-b border-zinc-800 text-zinc-500 font-medium">
                                <th className="pb-2">Route</th>
                                <th className="pb-2">Method</th>
                                <th className="pb-2">Status</th>
                                <th className="pb-2 text-right">Latency</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-zinc-850">
                              <tr>
                                <td className="py-2 font-mono text-zinc-300">/v1/auth/login</td>
                                <td className="py-2 text-zinc-400">POST</td>
                                <td className="py-2 text-emerald-400 font-medium">200 OK</td>
                                <td className="py-2 text-right font-mono text-zinc-400">34ms</td>
                              </tr>
                              <tr>
                                <td className="py-2 font-mono text-zinc-300">/v1/ingest/events</td>
                                <td className="py-2 text-zinc-400">POST</td>
                                <td className="py-2 text-emerald-400 font-medium">202 Acc</td>
                                <td className="py-2 text-right font-mono text-zinc-400">12ms</td>
                              </tr>
                              <tr>
                                <td className="py-2 font-mono text-zinc-300">/v1/vault/secrets</td>
                                <td className="py-2 text-zinc-400">GET</td>
                                <td className="py-2 text-emerald-400 font-medium">200 OK</td>
                                <td className="py-2 text-right font-mono text-zinc-400">18ms</td>
                              </tr>
                            </tbody>
                          </table>
                        </div>
                      )}

                      {/* 5. Incident Stream List */}
                      {widget.type === "incident_list" && (
                        <div className="space-y-2">
                          <div className="p-2.5 rounded-lg bg-rose-950/20 border border-rose-900/30 flex items-start justify-between gap-2">
                            <div>
                              <div className="flex items-center gap-1.5">
                                <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-rose-500/20 text-rose-400 uppercase">
                                  CRITICAL
                                </span>
                                <span className="text-[11px] font-semibold text-zinc-200">
                                  Downstream Timeout Breach
                                </span>
                              </div>
                              <p className="text-[10px] text-zinc-400 mt-1">
                                High p95 latency on checkout pipeline &gt; 500ms
                              </p>
                            </div>
                            <span className="text-[10px] text-zinc-500 font-mono">2m ago</span>
                          </div>
                          <div className="p-2.5 rounded-lg bg-amber-950/20 border border-amber-900/30 flex items-start justify-between gap-2">
                            <div>
                              <div className="flex items-center gap-1.5">
                                <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-amber-500/20 text-amber-400 uppercase">
                                  HIGH
                                </span>
                                <span className="text-[11px] font-semibold text-zinc-200">
                                  Worker Backlog Spike
                                </span>
                              </div>
                              <p className="text-[10px] text-zinc-400 mt-1">
                                Queue size reached 1,200 pending jobs
                              </p>
                            </div>
                            <span className="text-[10px] text-zinc-500 font-mono">14m ago</span>
                          </div>
                        </div>
                      )}

                      {/* 6. Live Log Stream */}
                      {widget.type === "log_stream" && (
                        <div className="p-2.5 rounded-lg bg-zinc-950 font-mono text-[11px] text-zinc-300 space-y-1.5 border border-zinc-800/80">
                          <div className="flex items-center gap-2 text-emerald-400">
                            <span className="text-zinc-600">[20:45:12]</span>
                            <span>[INFO] Batch worker processed 250 telemetry records</span>
                          </div>
                          <div className="flex items-center gap-2 text-amber-400">
                            <span className="text-zinc-600">[20:45:18]</span>
                            <span>[WARN] Retrying webhook delivery to external channel #3</span>
                          </div>
                          <div className="flex items-center gap-2 text-zinc-400">
                            <span className="text-zinc-600">[20:45:22]</span>
                            <span>[INFO] Cache hot state refreshed in Redis (0.8ms)</span>
                          </div>
                        </div>
                      )}

                      {/* 7. Markdown Runbook */}
                      {widget.type === "markdown" && (
                        <div className="prose prose-invert prose-xs text-[11px] text-zinc-300 leading-relaxed space-y-1 bg-zinc-950/40 p-3 rounded-lg border border-zinc-800/50">
                          <p className="font-semibold text-white">Operational Checklist:</p>
                          <ul className="list-disc list-inside space-y-0.5 text-zinc-400">
                            <li>Check RabbitMQ dead-letter queues on failure alarms.</li>
                            <li>Ensure vault transit encryption keys are valid.</li>
                            <li>Run load generation scripts on staging verification.</li>
                          </ul>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Modal: New Dashboard */}
      {isCreatingDashboard && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-900 p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <LayoutGrid className="w-4 h-4 text-emerald-400" />
                Create Custom Dashboard
              </h3>
              <button
                onClick={() => setIsCreatingDashboard(false)}
                className="text-zinc-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateDashboard} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-zinc-300">Dashboard Name</label>
                <Input
                  required
                  placeholder="e.g. SRE Core Metrics"
                  value={newDashboardName}
                  onChange={(e) => setNewDashboardName(e.target.value)}
                  className="bg-zinc-950 border-zinc-800 text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-zinc-300">Description (Optional)</label>
                <Input
                  placeholder="High-level description of this board"
                  value={newDashboardDesc}
                  onChange={(e) => setNewDashboardDesc(e.target.value)}
                  className="bg-zinc-950 border-zinc-800 text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-zinc-300">Tags (Comma-separated)</label>
                <Input
                  placeholder="api, edge, production"
                  value={newDashboardTags}
                  onChange={(e) => setNewDashboardTags(e.target.value)}
                  className="bg-zinc-950 border-zinc-800 text-xs"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-zinc-800">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsCreatingDashboard(false)}
                  className="text-xs text-zinc-400"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium"
                >
                  Create Board
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Add Widget */}
      {isAddingWidget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-lg rounded-2xl border border-zinc-800 bg-zinc-900 p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Plus className="w-4 h-4 text-emerald-400" />
                Add Widget to {activeDashboard?.name}
              </h3>
              <button
                onClick={() => setIsAddingWidget(false)}
                className="text-zinc-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAddWidget} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-zinc-300">Widget Title</label>
                <Input
                  required
                  placeholder="e.g. Ingestion Throughput (RPS)"
                  value={widgetTitle}
                  onChange={(e) => setWidgetTitle(e.target.value)}
                  className="bg-zinc-950 border-zinc-800 text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-zinc-300">Widget Type</label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {[
                    { type: "timeseries", label: "Timeseries", icon: Activity },
                    { type: "query_value", label: "Single Stat", icon: TrendingUp },
                    { type: "toplist", label: "Top-List", icon: ListOrdered },
                    { type: "table", label: "Table", icon: TableIcon },
                    { type: "incident_list", label: "Incidents", icon: AlertTriangle },
                    { type: "log_stream", label: "Log Stream", icon: Terminal },
                    { type: "markdown", label: "Runbook", icon: BookOpen },
                  ].map((item) => {
                    const Icon = item.icon;
                    const isSelected = widgetType === item.type;
                    return (
                      <button
                        key={item.type}
                        type="button"
                        onClick={() => setWidgetType(item.type as DashboardWidgetType)}
                        className={`p-2.5 rounded-xl border text-xs font-medium flex flex-col items-center gap-1.5 transition-all ${
                          isSelected
                            ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-300 shadow-sm"
                            : "bg-zinc-950 border-zinc-800 text-zinc-400 hover:text-zinc-200 hover:border-zinc-700"
                        }`}
                      >
                        <Icon className="w-4 h-4" />
                        <span className="text-[11px]">{item.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-zinc-300">Grid Span Width</label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { w: 4, label: "1/3 Column (4 cols)" },
                    { w: 6, label: "Half Width (6 cols)" },
                    { w: 12, label: "Full Width (12 cols)" },
                  ].map((span) => (
                    <button
                      key={span.w}
                      type="button"
                      onClick={() => setWidgetWidth(span.w)}
                      className={`p-2 rounded-lg border text-xs font-medium transition-all ${
                        widgetWidth === span.w
                          ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-300"
                          : "bg-zinc-950 border-zinc-800 text-zinc-400 hover:text-white"
                      }`}
                    >
                      {span.label}
                    </button>
                  ))}
                </div>
              </div>

              {(widgetType === "timeseries" || widgetType === "query_value") && (
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-zinc-300">Metric Name</label>
                    <Input
                      placeholder="http_requests_total"
                      value={widgetMetric}
                      onChange={(e) => setWidgetMetric(e.target.value)}
                      className="bg-zinc-950 border-zinc-800 text-xs"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-zinc-300">Unit</label>
                    <Input
                      placeholder="req/s, ms, %"
                      value={widgetUnit}
                      onChange={(e) => setWidgetUnit(e.target.value)}
                      className="bg-zinc-950 border-zinc-800 text-xs"
                    />
                  </div>
                </div>
              )}

              {widgetType === "markdown" && (
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-zinc-300">Markdown Content</label>
                  <textarea
                    rows={4}
                    value={widgetMarkdown}
                    onChange={(e) => setWidgetMarkdown(e.target.value)}
                    className="w-full rounded-md bg-zinc-950 border border-zinc-800 p-2.5 text-xs text-zinc-200 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                </div>
              )}

              <div className="flex justify-end gap-2 pt-3 border-t border-zinc-800">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsAddingWidget(false)}
                  className="text-xs text-zinc-400"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium"
                >
                  Add Widget
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Confirmation Dialog: Delete Dashboard */}
      {isDeletingDashboard && activeDashboard && (
        <ConfirmDialog
          isOpen={isDeletingDashboard}
          title={`Delete "${activeDashboard.name}"?`}
          description="Are you sure you want to delete this custom dashboard and all its configured widgets? This action cannot be undone."
          confirmLabel="Delete Dashboard"
          variant="danger"
          onConfirm={() => void handleDeleteDashboard()}
          onCancel={() => setIsDeletingDashboard(false)}
        />
      )}
    </div>
  );
}
