import {
  Activity,
  AlertCircle,
  BarChart3,
  CheckCircle2,
  Clock,
  Code2,
  ExternalLink,
  Flame,
  Globe,
  Layers,
  Monitor,
  Play,
  Plus,
  Radio,
  RefreshCw,
  Search,
  ShieldAlert,
  Smartphone,
  Tablet,
  Timer,
  Trash2,
  TrendingUp,
  X,
  Zap,
} from "lucide-react";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import {
  createUptimeCheck,
  deleteUptimeCheck,
  getRumOverview,
  getUptimeCheckHistory,
  listUptimeChecks,
  testUptimeCheck,
  type AssertionType,
  type CreateUptimeCheckInput,
  type HttpMethod,
  type RumOverview,
  type SyntheticAssertion,
  type UptimeCheck,
  type UptimeCheckResult,
} from "@/features/uptime-rum/api";
import { getApiErrorMessage } from "@/lib/api-client";
import { createPulseOpsSocket, joinProjectRoom, leaveProjectRoom } from "@/lib/socket-client";
import { cn } from "@/lib/utils";
import { useDashboardContext } from "./DashboardLayout";

export function UptimeRumPage() {
  const { selectedEnvironment, selectedProject } = useDashboardContext();
  const { notify } = useToast();

  const [activeTab, setActiveTab] = useState<"monitors" | "rum">("monitors");
  const [checks, setChecks] = useState<UptimeCheck[]>([]);
  const [rumOverview, setRumOverview] = useState<RumOverview | null>(null);
  const [selectedCheckId, setSelectedCheckId] = useState<string | null>(null);
  const [history, setHistory] = useState<UptimeCheckResult[]>([]);
  const [isRunningTest, setIsRunningTest] = useState<string | null>(null);
  const [testResultModal, setTestResultModal] = useState<UptimeCheckResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // New Monitor Modal
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newCheckName, setNewCheckName] = useState("");
  const [newCheckUrl, setNewCheckUrl] = useState("https://api.example.com/health");
  const [newCheckMethod, setNewCheckMethod] = useState<HttpMethod>("GET");
  const [newCheckInterval, setNewCheckInterval] = useState(60);
  const [newCheckTimeout, setNewCheckTimeout] = useState(3000);
  const [newCheckExpectedStatus, setNewCheckExpectedStatus] = useState(200);
  const [newAssertions, setNewAssertions] = useState<SyntheticAssertion[]>([
    { type: "status_code", target: "status", operator: "equals", expectedValue: 200 },
    { type: "response_time", target: "latency", operator: "less_than", expectedValue: 500 },
  ]);

  async function loadData(): Promise<void> {
    if (!selectedProject) return;
    setIsLoading(true);
    try {
      const [chkList, rum] = await Promise.all([
        listUptimeChecks(selectedProject.id),
        getRumOverview(selectedProject.id),
      ]);
      setChecks(chkList);
      setRumOverview(rum);
      if (chkList.length > 0 && !selectedCheckId) {
        setSelectedCheckId(chkList[0]!.id);
      }
    } catch (err) {
      notify({
        title: "Failed to load uptime data",
        description: getApiErrorMessage(err),
        variant: "error",
      });
    } finally {
      setIsLoading(false);
    }
  }

  async function loadHistory(checkId: string): Promise<void> {
    if (!selectedProject) return;
    try {
      const hist = await getUptimeCheckHistory(selectedProject.id, checkId);
      setHistory(hist);
    } catch {
      // Ignore
    }
  }

  useEffect(() => {
    void loadData();
  }, [selectedProject?.id, selectedEnvironment]);

  useEffect(() => {
    if (selectedCheckId) {
      void loadHistory(selectedCheckId);
    }
  }, [selectedCheckId, selectedProject?.id]);

  // Live WebSocket
  useEffect(() => {
    if (!selectedProject) return;
    const socket = createPulseOpsSocket();
    if (!socket) return;

    socket.on("connect", () => {
      void joinProjectRoom(socket, selectedProject.id, selectedEnvironment);
    });
    socket.on("event.created", (update) => {
      if (update.event.type === "metric") {
        void loadData();
      }
    });
    socket.connect();

    return () => {
      leaveProjectRoom(socket, selectedProject.id, selectedEnvironment);
      socket.disconnect();
    };
  }, [selectedProject?.id, selectedEnvironment]);

  const handleRunTest = async (id: string) => {
    if (!selectedProject) return;
    setIsRunningTest(id);
    try {
      const res = await testUptimeCheck(selectedProject.id, id);
      setTestResultModal(res);
      void loadData();
      if (selectedCheckId === id) void loadHistory(id);
      notify({
        title: res.status === "up" ? "Check Passed" : "Check Degraded/Failed",
        description: `Completed in ${res.responseTimeMs}ms with ${res.assertionResults.filter((a) => a.passed).length}/${res.assertionResults.length} assertions passed.`,
        variant: res.status === "up" ? "success" : "error",
      });
    } catch (err) {
      notify({
        title: "Test execution failed",
        description: getApiErrorMessage(err),
        variant: "error",
      });
    } finally {
      setIsRunningTest(null);
    }
  };

  const handleCreateCheck = async (e: FormEvent) => {
    e.preventDefault();
    if (!selectedProject || !newCheckName.trim() || !newCheckUrl.trim()) return;

    try {
      const created = await createUptimeCheck(selectedProject.id, {
        name: newCheckName.trim(),
        url: newCheckUrl.trim(),
        method: newCheckMethod,
        intervalSeconds: Number(newCheckInterval),
        timeoutMs: Number(newCheckTimeout),
        expectedStatusCode: Number(newCheckExpectedStatus),
        syntheticAssertions: newAssertions,
      });

      setChecks((prev) => [...prev, created]);
      setSelectedCheckId(created.id);
      setIsCreateModalOpen(false);
      setNewCheckName("");
      notify({
        title: "Monitor Created",
        description: `Synthetic probe ${created.name} is now actively monitored.`,
        variant: "success",
      });
    } catch (err) {
      notify({
        title: "Failed to create check",
        description: getApiErrorMessage(err),
        variant: "error",
      });
    }
  };

  const handleDeleteCheck = async (id: string, name: string) => {
    if (!selectedProject) return;
    try {
      await deleteUptimeCheck(selectedProject.id, id);
      setChecks((prev) => prev.filter((c) => c.id !== id));
      if (selectedCheckId === id) setSelectedCheckId(null);
      notify({ title: "Monitor Deleted", description: `Removed ${name}`, variant: "info" });
    } catch (err) {
      notify({ title: "Delete failed", description: getApiErrorMessage(err), variant: "error" });
    }
  };

  const addAssertion = () => {
    setNewAssertions((prev) => [
      ...prev,
      { type: "body_contains", target: "body", operator: "contains", expectedValue: "healthy" },
    ]);
  };

  const removeAssertion = (index: number) => {
    setNewAssertions((prev) => prev.filter((_, i) => i !== index));
  };

  const globalUptime = useMemo(() => {
    if (checks.length === 0) return 100.0;
    return Number(
      (checks.reduce((acc, c) => acc + c.uptimePercent24h, 0) / checks.length).toFixed(2),
    );
  }, [checks]);

  const avgFleetLatency = useMemo(() => {
    if (checks.length === 0) return 0;
    return Number(
      (checks.reduce((acc, c) => acc + c.avgResponseTimeMs, 0) / checks.length).toFixed(1),
    );
  }, [checks]);

  return (
    <main className="mx-auto flex max-w-7xl flex-col gap-6">
      {/* Header */}
      <header className="flex flex-col gap-3 border-b border-zinc-800 pb-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-emerald-400">
              {selectedProject?.name ?? "No project selected"} / {selectedEnvironment}
            </span>
            <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Continuous Probing Active
            </span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white mt-1">
            Uptime, Synthetics & Real User Monitoring (RUM)
          </h1>
          <p className="mt-1 max-w-3xl text-xs text-zinc-400">
            Automated synthetic SLA assertions, global endpoint availability tracking, and Google Core Web Vitals performance analytics.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            onClick={() => void loadData()}
            variant="outline"
            className="text-xs gap-1.5 h-9"
          >
            <RefreshCw className={cn("h-3.5 w-3.5", isLoading && "animate-spin")} />
            Refresh
          </Button>

          <Button
            onClick={() => setIsCreateModalOpen(true)}
            className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold gap-1.5 h-9 shadow-lg shadow-emerald-600/20"
          >
            <Plus className="h-3.5 w-3.5" />
            New Synthetic Monitor
          </Button>
        </div>
      </header>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4 backdrop-blur-md">
          <div className="flex items-center justify-between text-zinc-400">
            <span className="text-xs font-semibold uppercase tracking-wider">Global Availability</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          </div>
          <p className="text-2xl font-bold text-white font-mono mt-2">{globalUptime}%</p>
          <p className="text-[11px] text-zinc-500 mt-1">Average 24h uptime across all monitors</p>
        </div>

        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4 backdrop-blur-md">
          <div className="flex items-center justify-between text-zinc-400">
            <span className="text-xs font-semibold uppercase tracking-wider">Monitored Endpoints</span>
            <Globe className="w-4 h-4 text-cyan-400" />
          </div>
          <p className="text-2xl font-bold text-white font-mono mt-2">
            {checks.filter((c) => c.status === "up").length} / {checks.length} Up
          </p>
          <p className="text-[11px] text-zinc-500 mt-1">Synthetic probes running</p>
        </div>

        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4 backdrop-blur-md">
          <div className="flex items-center justify-between text-zinc-400">
            <span className="text-xs font-semibold uppercase tracking-wider">Avg Latency SLA</span>
            <Timer className="w-4 h-4 text-purple-400" />
          </div>
          <p className="text-2xl font-bold text-white font-mono mt-2">{avgFleetLatency} ms</p>
          <p className="text-[11px] text-zinc-500 mt-1">Response time across probes</p>
        </div>

        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4 backdrop-blur-md">
          <div className="flex items-center justify-between text-zinc-400">
            <span className="text-xs font-semibold uppercase tracking-wider">Core Web Vitals</span>
            <TrendingUp className="w-4 h-4 text-amber-400" />
          </div>
          <p className="text-2xl font-bold text-white font-mono mt-2">
            {rumOverview?.lcpGrade === "good" ? "Fast & Healthy" : "Needs Review"}
          </p>
          <p className="text-[11px] text-zinc-500 mt-1">LCP: {rumOverview?.avgLcpMs}ms (Good &lt; 2.5s)</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-zinc-800 pb-2">
        <button
          onClick={() => setActiveTab("monitors")}
          className={cn(
            "flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all",
            activeTab === "monitors"
              ? "bg-zinc-800 text-white border border-zinc-700 shadow-md"
              : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/60",
          )}
        >
          <Globe className="w-4 h-4 text-emerald-400" />
          Uptime & Synthetic Probes ({checks.length})
        </button>

        <button
          onClick={() => setActiveTab("rum")}
          className={cn(
            "flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all",
            activeTab === "rum"
              ? "bg-zinc-800 text-white border border-zinc-700 shadow-md"
              : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/60",
          )}
        >
          <Activity className="w-4 h-4 text-cyan-400" />
          Core Web Vitals & RUM
        </button>
      </div>

      {/* Tab 1: Uptime Monitors */}
      {activeTab === "monitors" && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4">
            {checks.map((chk) => (
              <div
                key={chk.id}
                onClick={() => setSelectedCheckId(chk.id)}
                className={cn(
                  "rounded-2xl border p-5 transition-all cursor-pointer backdrop-blur-md",
                  selectedCheckId === chk.id
                    ? "border-emerald-500/50 bg-zinc-900/90 shadow-xl shadow-emerald-500/5"
                    : "border-zinc-800 bg-zinc-900/60 hover:border-zinc-700 hover:bg-zinc-850/60",
                )}
              >
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span
                        className={cn(
                          "w-2.5 h-2.5 rounded-full",
                          chk.status === "up" ? "bg-emerald-400" : "bg-rose-400 animate-pulse",
                        )}
                      />
                      <h3 className="text-sm font-bold text-white">{chk.name}</h3>
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-zinc-800 text-zinc-300 font-mono">
                        {chk.method}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 text-xs text-zinc-400 font-mono">
                      <span className="truncate max-w-md">{chk.url}</span>
                      <span>•</span>
                      <span>Interval: {chk.intervalSeconds}s</span>
                      <span>•</span>
                      <span>Expected Status: {chk.expectedStatusCode}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-6">
                    {/* Availability Bar Strip */}
                    <div className="space-y-1">
                      <div className="flex justify-between text-[11px] font-mono text-zinc-400">
                        <span>24h Availability</span>
                        <span className="font-bold text-emerald-400">{chk.uptimePercent24h}%</span>
                      </div>
                      <div className="flex items-center gap-1">
                        {Array.from({ length: 24 }).map((_, idx) => (
                          <div
                            key={idx}
                            className="w-1.5 h-6 rounded-sm bg-emerald-500/80 hover:bg-emerald-400 transition-colors"
                            title={`Hour ${idx + 1}: 100% Up`}
                          />
                        ))}
                      </div>
                    </div>

                    {/* Latency Metric */}
                    <div className="text-right font-mono space-y-0.5">
                      <p className="text-[10px] text-zinc-500 uppercase font-bold">Avg Latency</p>
                      <p className="text-base font-bold text-white">{chk.avgResponseTimeMs} ms</p>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2">
                      <Button
                        onClick={(e) => {
                          e.stopPropagation();
                          void handleRunTest(chk.id);
                        }}
                        disabled={isRunningTest === chk.id}
                        className="text-xs h-8 px-3 bg-emerald-600 hover:bg-emerald-500 text-white gap-1.5"
                      >
                        <Play className={cn("w-3.5 h-3.5", isRunningTest === chk.id && "animate-spin")} />
                        Run Test
                      </Button>

                      <Button
                        onClick={(e) => {
                          e.stopPropagation();
                          void handleDeleteCheck(chk.id, chk.name);
                        }}
                        variant="ghost"
                        className="text-rose-400 hover:text-rose-300 h-8 px-2"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </div>

                {/* Synthetic Assertions Pill Grid */}
                {chk.syntheticAssertions && chk.syntheticAssertions.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1.5 pt-3 mt-3 border-t border-zinc-800/80">
                    <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wide mr-1">
                      Synthetic Rules:
                    </span>
                    {chk.syntheticAssertions.map((a, idx) => (
                      <span
                        key={idx}
                        className="px-2 py-0.5 rounded-lg text-[10px] font-mono bg-zinc-950 text-cyan-400 border border-zinc-800"
                      >
                        {a.type} {a.operator} {a.expectedValue}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab 2: Core Web Vitals & RUM */}
      {activeTab === "rum" && rumOverview && (
        <div className="space-y-6">
          {/* Core Web Vitals Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* LCP Card */}
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5 backdrop-blur-md space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-zinc-400">
                  Largest Contentful Paint (LCP)
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  GOOD
                </span>
              </div>
              <p className="text-3xl font-bold font-mono text-white">{rumOverview.avgLcpMs} ms</p>
              <p className="text-xs text-zinc-500">
                Measures perceived loading speed. Benchmark: &lt; 2500ms is considered good.
              </p>
            </div>

            {/* FID / INP Card */}
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5 backdrop-blur-md space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-zinc-400">
                  First Input Delay (FID)
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  GOOD
                </span>
              </div>
              <p className="text-3xl font-bold font-mono text-white">{rumOverview.avgFidMs} ms</p>
              <p className="text-xs text-zinc-500">
                Measures page responsiveness and main-thread blockage. Benchmark: &lt; 100ms.
              </p>
            </div>

            {/* CLS Card */}
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5 backdrop-blur-md space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-zinc-400">
                  Cumulative Layout Shift (CLS)
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  GOOD
                </span>
              </div>
              <p className="text-3xl font-bold font-mono text-white">{rumOverview.avgCls}</p>
              <p className="text-xs text-zinc-500">
                Measures visual stability during render. Benchmark: &lt; 0.1 is considered good.
              </p>
            </div>
          </div>

          {/* Browser & Device Breakdown Table */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5 backdrop-blur-md">
              <h4 className="text-sm font-bold text-white mb-3">Traffic by Browser</h4>
              <div className="space-y-3">
                {rumOverview.browserBreakdown.map((b) => (
                  <div key={b.browser} className="space-y-1">
                    <div className="flex justify-between text-xs font-mono text-zinc-300">
                      <span>{b.browser}</span>
                      <span>{b.count} views ({b.percentage}%)</span>
                    </div>
                    <div className="w-full h-1.5 rounded-full bg-zinc-800 overflow-hidden">
                      <div className="h-full rounded-full bg-cyan-400" style={{ width: `${b.percentage}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5 backdrop-blur-md">
              <h4 className="text-sm font-bold text-white mb-3">Traffic by Device Form Factor</h4>
              <div className="space-y-3">
                {rumOverview.deviceBreakdown.map((d) => (
                  <div key={d.device} className="space-y-1">
                    <div className="flex justify-between text-xs font-mono text-zinc-300">
                      <span className="capitalize">{d.device}</span>
                      <span>{d.count} views ({d.percentage}%)</span>
                    </div>
                    <div className="w-full h-1.5 rounded-full bg-zinc-800 overflow-hidden">
                      <div className="h-full rounded-full bg-purple-500" style={{ width: `${d.percentage}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Test Result Details */}
      {testResultModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-lg rounded-2xl border border-zinc-800 bg-zinc-900 p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Activity className="w-4 h-4 text-emerald-400" />
                Synthetic Test Execution Results
              </h3>
              <button onClick={() => setTestResultModal(null)} className="text-zinc-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2 bg-zinc-950 p-3 rounded-xl border border-zinc-800 text-xs">
                <div>
                  <span className="text-zinc-500">Status:</span>{" "}
                  <span className={cn("font-bold uppercase", testResultModal.status === "up" ? "text-emerald-400" : "text-rose-400")}>
                    {testResultModal.status}
                  </span>
                </div>
                <div>
                  <span className="text-zinc-500">HTTP Status:</span>{" "}
                  <span className="font-mono font-bold text-white">{testResultModal.statusCode}</span>
                </div>
                <div>
                  <span className="text-zinc-500">Duration:</span>{" "}
                  <span className="font-mono font-bold text-white">{testResultModal.responseTimeMs} ms</span>
                </div>
                <div>
                  <span className="text-zinc-500">Timestamp:</span>{" "}
                  <span className="font-mono text-zinc-400 text-[10px]">{testResultModal.timestamp}</span>
                </div>
              </div>

              <div className="space-y-2">
                <h4 className="text-xs font-bold text-zinc-300 uppercase">Evaluated Assertions</h4>
                <div className="divide-y divide-zinc-850 rounded-xl border border-zinc-800 bg-zinc-950/60 overflow-hidden">
                  {testResultModal.assertionResults.map((a, idx) => (
                    <div key={idx} className="p-2.5 flex items-center justify-between text-xs">
                      <span className="font-mono text-zinc-300">{a.name}</span>
                      <span className={cn("font-bold text-[10px] px-2 py-0.5 rounded uppercase", a.passed ? "bg-emerald-500/10 text-emerald-400" : "bg-rose-500/10 text-rose-400")}>
                        {a.passed ? "PASSED" : "FAILED"}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-3 border-t border-zinc-800">
              <Button onClick={() => setTestResultModal(null)} className="text-xs bg-zinc-800 hover:bg-zinc-700 text-white">
                Close
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Create Synthetic Monitor */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-xl rounded-2xl border border-zinc-800 bg-zinc-900 p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Plus className="w-4 h-4 text-emerald-400" />
                Configure Synthetic Uptime Monitor
              </h3>
              <button onClick={() => setIsCreateModalOpen(false)} className="text-zinc-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateCheck} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-zinc-300">Monitor Name</label>
                <Input
                  required
                  placeholder="e.g. Production Checkout Health"
                  value={newCheckName}
                  onChange={(e) => setNewCheckName(e.target.value)}
                  className="bg-zinc-950 border-zinc-800 text-xs"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-zinc-300">HTTP Method</label>
                  <select
                    value={newCheckMethod}
                    onChange={(e) => setNewCheckMethod(e.target.value as HttpMethod)}
                    className="h-10 w-full rounded-md border border-zinc-800 bg-zinc-950 px-3 text-xs text-white"
                  >
                    <option value="GET">GET</option>
                    <option value="POST">POST</option>
                    <option value="HEAD">HEAD</option>
                    <option value="PUT">PUT</option>
                  </select>
                </div>

                <div className="col-span-2 space-y-1">
                  <label className="text-xs font-semibold text-zinc-300">Endpoint URL</label>
                  <Input
                    required
                    placeholder="https://service.domain.com/health"
                    value={newCheckUrl}
                    onChange={(e) => setNewCheckUrl(e.target.value)}
                    className="bg-zinc-950 border-zinc-800 text-xs font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-zinc-300">Interval (sec)</label>
                  <Input
                    type="number"
                    value={newCheckInterval}
                    onChange={(e) => setNewCheckInterval(Number(e.target.value))}
                    className="bg-zinc-950 border-zinc-800 text-xs"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-zinc-300">Timeout SLA (ms)</label>
                  <Input
                    type="number"
                    value={newCheckTimeout}
                    onChange={(e) => setNewCheckTimeout(Number(e.target.value))}
                    className="bg-zinc-950 border-zinc-800 text-xs"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-zinc-300">Expected Code</label>
                  <Input
                    type="number"
                    value={newCheckExpectedStatus}
                    onChange={(e) => setNewCheckExpectedStatus(Number(e.target.value))}
                    className="bg-zinc-950 border-zinc-800 text-xs"
                  />
                </div>
              </div>

              {/* Synthetic Assertions Builder */}
              <div className="space-y-2 pt-2 border-t border-zinc-800">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold uppercase text-zinc-400">Synthetic Assertions</label>
                  <Button
                    type="button"
                    onClick={addAssertion}
                    variant="outline"
                    className="text-xs h-7 px-2 border-zinc-700"
                  >
                    <Plus className="w-3 h-3 mr-1" /> Add Assertion
                  </Button>
                </div>

                <div className="space-y-2">
                  {newAssertions.map((a, idx) => (
                    <div key={idx} className="flex items-center gap-2 bg-zinc-950 p-2.5 rounded-xl border border-zinc-800">
                      <span className="text-xs font-mono text-cyan-400 w-28 truncate">{a.type}</span>
                      <span className="text-xs text-zinc-500 font-mono">{a.operator}</span>
                      <span className="text-xs font-mono text-white flex-1 truncate">{String(a.expectedValue)}</span>
                      <button
                        type="button"
                        onClick={() => removeAssertion(idx)}
                        className="text-rose-400 hover:text-rose-300 p-1"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-zinc-800">
                <Button type="button" variant="ghost" onClick={() => setIsCreateModalOpen(false)} className="text-xs text-zinc-400">
                  Cancel
                </Button>
                <Button type="submit" className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium">
                  Create Probe
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}
