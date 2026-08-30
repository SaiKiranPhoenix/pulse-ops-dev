import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Flame,
  Gauge,
  Layers,
  Loader2,
  Play,
  Plus,
  RefreshCw,
  Search,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Target,
  Trash2,
  TrendingDown,
  TrendingUp,
  X,
  Zap,
} from "lucide-react";
import { type FormEvent, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import {
  createSlo,
  deleteSlo,
  evaluateSlo,
  getReliabilityReport,
  listSlos,
  seedDemoSlos,
  updateSlo,
  type ReliabilityReport,
  type SliType,
  type SloDocumentData,
  type SloStatus,
} from "@/features/slos/api";
import { getApiErrorMessage } from "@/lib/api-client";
import { useDashboardContext } from "./DashboardLayout";

export function SloPage() {
  const { selectedEnvironment, selectedProject } = useDashboardContext();
  const { notify } = useToast();

  const [slos, setSlos] = useState<SloDocumentData[]>([]);
  const [report, setReport] = useState<ReliabilityReport | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [sliTypeFilter, setSliTypeFilter] = useState<string>("all");

  // Creation Wizard Modal State
  const [isCreatingSlo, setIsCreatingSlo] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSeeding, setIsSeeding] = useState(false);
  const [evaluatingSloId, setEvaluatingSloId] = useState<string | null>(null);

  // Form State
  const [formName, setFormName] = useState("");
  const [formDesc, setFormDesc] = useState("");
  const [formSliType, setFormSliType] = useState<SliType>("availability");
  const [formService, setFormService] = useState("");
  const [formLatencyThreshold, setFormLatencyThreshold] = useState(300);
  const [formTargetPercent, setFormTargetPercent] = useState(99.9);
  const [formWarningPercent, setFormWarningPercent] = useState(99.95);
  const [formWindowDays, setFormWindowDays] = useState(30);

  const loadData = async () => {
    if (!selectedProject) {
      setSlos([]);
      setReport(null);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    try {
      const [listData, reportData] = await Promise.all([
        listSlos(selectedProject.id),
        getReliabilityReport(selectedProject.id),
      ]);
      setSlos(listData);
      setReport(reportData);
    } catch {
      // ignore
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, [selectedProject?.id]);

  const handleCreateSlo = async (e: FormEvent) => {
    e.preventDefault();
    if (!selectedProject || !formName.trim()) return;

    setIsSubmitting(true);
    try {
      const created = await createSlo(selectedProject.id, {
        name: formName.trim(),
        description: formDesc.trim() || undefined,
        sli: {
          type: formSliType,
          serviceName: formService.trim() || undefined,
          environment: selectedEnvironment,
          thresholdMs: formSliType === "latency" ? Number(formLatencyThreshold) : undefined,
        },
        target: {
          targetPercent: Number(formTargetPercent),
          warningPercent: Number(formWarningPercent),
          rollingWindowDays: Number(formWindowDays),
        },
        tags: [formSliType],
        enabled: true,
      });

      setSlos([created, ...slos]);
      setIsCreatingSlo(false);
      setFormName("");
      setFormDesc("");
      notify({
        variant: "success",
        title: "SLO Configured",
        description: `Objective "${created.name}" is now active with initial error budget.`,
      });
      await loadData();
    } catch (err) {
      notify({
        variant: "error",
        title: "Creation Failed",
        description: getApiErrorMessage(err),
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEvaluateSlo = async (sloId: string) => {
    if (!selectedProject) return;
    setEvaluatingSloId(sloId);
    try {
      const res = await evaluateSlo(selectedProject.id, sloId);
      setSlos(slos.map((s) => (s.id === sloId ? res.slo : s)));
      notify({
        variant: res.calculation.status === "breached" ? "error" : "success",
        title: `SLO Evaluated: ${res.calculation.status.toUpperCase()}`,
        description: `Current SLI: ${res.calculation.currentSliPercent}% | Error Budget: ${res.calculation.errorBudgetRemainingPercent}%`,
      });
      await loadData();
    } catch (err) {
      notify({
        variant: "error",
        title: "Evaluation Failed",
        description: getApiErrorMessage(err),
      });
    } finally {
      setEvaluatingSloId(null);
    }
  };

  const handleDeleteSlo = async (sloId: string) => {
    if (!selectedProject) return;
    try {
      await deleteSlo(selectedProject.id, sloId);
      setSlos(slos.filter((s) => s.id !== sloId));
      notify({ variant: "success", title: "SLO Deleted", description: "Objective removed." });
      await loadData();
    } catch (err) {
      notify({ variant: "error", title: "Action Failed", description: getApiErrorMessage(err) });
    }
  };

  const handleToggleSlo = async (slo: SloDocumentData) => {
    if (!selectedProject) return;
    try {
      const updated = await updateSlo(selectedProject.id, slo.id, {
        enabled: !slo.enabled,
      });
      setSlos(slos.map((s) => (s.id === slo.id ? updated : s)));
      notify({
        variant: "success",
        title: updated.enabled ? "SLO Resumed" : "SLO Paused",
        description: `"${slo.name}" state updated.`,
      });
    } catch (err) {
      notify({ variant: "error", title: "Action Failed", description: getApiErrorMessage(err) });
    }
  };

  const handleSeedDemo = async () => {
    if (!selectedProject) return;
    setIsSeeding(true);
    try {
      const res = await seedDemoSlos(selectedProject.id);
      notify({
        variant: "success",
        title: "Demo SLOs Seeded",
        description: `Created and evaluated ${res.seededCount} production reliability objectives.`,
      });
      await loadData();
    } catch (err) {
      notify({ variant: "error", title: "Seed Failed", description: getApiErrorMessage(err) });
    } finally {
      setIsSeeding(false);
    }
  };

  const filteredSlos = useMemo(() => {
    return slos.filter((slo) => {
      const matchesSearch =
        search === "" ||
        slo.name.toLowerCase().includes(search.toLowerCase()) ||
        (slo.description && slo.description.toLowerCase().includes(search.toLowerCase())) ||
        (slo.sli.serviceName && slo.sli.serviceName.toLowerCase().includes(search.toLowerCase()));

      const matchesStatus =
        statusFilter === "all" || (slo.calculation?.status ?? "compliant") === statusFilter;
      const matchesType = sliTypeFilter === "all" || slo.sli.type === sliTypeFilter;

      return matchesSearch && matchesStatus && matchesType;
    });
  }, [slos, search, statusFilter, sliTypeFilter]);

  return (
    <div className="space-y-6 pb-16">
      {/* Header Banner */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-tr from-emerald-500/20 to-cyan-500/20 text-emerald-400 border border-emerald-500/30 shadow-lg shadow-emerald-500/10">
              <Target className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2.5">
                Service Level Objectives (SLOs)
              </h1>
              <p className="text-sm text-zinc-400">
                Track availability, latency, error budgets, and multi-window burn rates across your microservices.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <Button
            type="button"
            onClick={handleSeedDemo}
            disabled={isSeeding}
            className="bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs h-9 px-3 border border-zinc-700"
          >
            {isSeeding ? (
              <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
            ) : (
              <Sparkles className="h-3.5 w-3.5 mr-1.5 text-amber-400" />
            )}
            Seed Demo SLOs
          </Button>

          <Button
            type="button"
            onClick={() => setIsCreatingSlo(true)}
            className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs h-9 px-3.5 shadow-lg shadow-emerald-600/20"
          >
            <Plus className="h-3.5 w-3.5 mr-1.5" />
            Create Objective
          </Button>
        </div>
      </div>

      {/* KPI Overview Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Reliability Score */}
        <div className="rounded-2xl border border-zinc-800/80 bg-zinc-900/50 p-5 shadow-lg backdrop-blur-md space-y-2">
          <div className="flex items-center justify-between text-xs text-zinc-400">
            <span className="font-semibold uppercase tracking-wider text-[11px]">Reliability Score</span>
            <ShieldCheck className="h-4 w-4 text-emerald-400" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-white">
              {report?.overallReliabilityScore ?? 100}%
            </span>
            <span className="text-xs text-emerald-400 font-semibold flex items-center">
              <TrendingUp className="h-3 w-3 mr-0.5" />
              Healthy
            </span>
          </div>
          <p className="text-[11px] text-zinc-500">Across {report?.totalSlos ?? 0} active objectives</p>
        </div>

        {/* Compliant Objectives */}
        <div className="rounded-2xl border border-emerald-500/20 bg-emerald-950/10 p-5 shadow-lg space-y-2">
          <div className="flex items-center justify-between text-xs text-emerald-400 font-semibold">
            <span className="uppercase tracking-wider text-[11px]">Compliant SLOs</span>
            <CheckCircle2 className="h-4 w-4 text-emerald-400" />
          </div>
          <div className="text-3xl font-extrabold text-emerald-400">
            {report?.compliantCount ?? 0}
          </div>
          <p className="text-[11px] text-emerald-400/70">100% within healthy error margin</p>
        </div>

        {/* At Risk & Breached */}
        <div className="rounded-2xl border border-amber-500/20 bg-amber-950/10 p-5 shadow-lg space-y-2">
          <div className="flex items-center justify-between text-xs text-amber-400 font-semibold">
            <span className="uppercase tracking-wider text-[11px]">At Risk / Breached</span>
            <Flame className="h-4 w-4 text-rose-400" />
          </div>
          <div className="flex items-baseline gap-3">
            <span className="text-3xl font-extrabold text-amber-400">
              {report?.atRiskCount ?? 0}
            </span>
            <span className="text-xs text-rose-400 font-bold">
              / {report?.breachedCount ?? 0} Breached
            </span>
          </div>
          <p className="text-[11px] text-amber-400/70">Elevated error budget consumption</p>
        </div>

        {/* Average Budget Remaining */}
        <div className="rounded-2xl border border-zinc-800/80 bg-zinc-900/50 p-5 shadow-lg backdrop-blur-md space-y-2">
          <div className="flex items-center justify-between text-xs text-zinc-400">
            <span className="font-semibold uppercase tracking-wider text-[11px]">Avg Error Budget</span>
            <Gauge className="h-4 w-4 text-cyan-400" />
          </div>
          <div className="text-3xl font-extrabold text-cyan-300">
            {report?.averageRemainingBudgetPercent ?? 100}%
          </div>
          <p className="text-[11px] text-zinc-500">Remaining across all services</p>
        </div>
      </div>

      {/* Filter & Toolbar */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 p-4 rounded-xl bg-zinc-900/60 border border-zinc-800/80 backdrop-blur-md">
        <div className="flex flex-wrap items-center gap-3 flex-1">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search objectives by name or service..."
              className="w-full pl-9 pr-4 py-1.5 text-xs rounded-lg bg-zinc-950/80 border border-zinc-800 text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div className="flex items-center rounded-lg bg-zinc-950/80 border border-zinc-800 p-0.5">
            {["all", "compliant", "at_risk", "breached"].map((st) => (
              <button
                key={st}
                type="button"
                onClick={() => setStatusFilter(st)}
                className={`px-3 py-1 text-xs font-semibold rounded-md transition-all ${
                  statusFilter === st
                    ? "bg-zinc-800 text-white shadow-sm"
                    : "text-zinc-400 hover:text-zinc-200"
                }`}
              >
                {st === "all" ? "All Statuses" : st.replace("_", " ").toUpperCase()}
              </button>
            ))}
          </div>

          <select
            value={sliTypeFilter}
            onChange={(e) => setSliTypeFilter(e.target.value)}
            className="px-3 py-1.5 rounded-lg bg-zinc-950 border border-zinc-800 text-xs text-zinc-300 focus:outline-none"
          >
            <option value="all">All SLI Types</option>
            <option value="availability">Availability (%)</option>
            <option value="latency">Latency Threshold (ms)</option>
            <option value="error_rate">Error Rate (%)</option>
          </select>
        </div>

        <Button
          type="button"
          onClick={loadData}
          disabled={isLoading}
          className="bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs h-8 px-3"
        >
          <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${isLoading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {/* SLO Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {filteredSlos.length === 0 ? (
          <div className="col-span-full rounded-2xl border border-zinc-800 bg-zinc-900/40 p-12 text-center text-zinc-500 text-xs">
            No SLOs found. Click &quot;Seed Demo SLOs&quot; or &quot;Create Objective&quot; to configure your first service level objective.
          </div>
        ) : (
          filteredSlos.map((slo) => {
            const calc = slo.calculation;
            const remainingBudget = calc?.errorBudgetRemainingPercent ?? 100;
            const currentSli = calc?.currentSliPercent ?? 100;
            const status = calc?.status ?? "compliant";

            // Status Styling
            const statusColor =
              status === "compliant"
                ? "emerald"
                : status === "at_risk"
                  ? "amber"
                  : "rose";

            return (
              <div
                key={slo.id}
                className="rounded-2xl border border-zinc-800/80 bg-zinc-900/50 p-5 shadow-xl backdrop-blur-md space-y-4 flex flex-col justify-between"
              >
                <div className="space-y-3">
                  {/* Top Row: Status badge & Toggle */}
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <span
                          className={`rounded-md px-2 py-0.5 text-[10px] font-bold uppercase ${
                            status === "compliant"
                              ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                              : status === "at_risk"
                                ? "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                                : "bg-rose-500/10 text-rose-400 border border-rose-500/20 animate-pulse"
                          }`}
                        >
                          {status.replace("_", " ")}
                        </span>
                        <span className="rounded-md bg-zinc-800 px-2 py-0.5 text-[10px] font-semibold text-zinc-400 uppercase">
                          {slo.sli.type}
                        </span>
                      </div>
                      <h3 className="text-base font-bold text-white mt-1.5 line-clamp-1">{slo.name}</h3>
                      {slo.sli.serviceName && (
                        <div className="text-xs text-zinc-400 flex items-center gap-1 mt-0.5">
                          <span className="font-mono text-cyan-400">{slo.sli.serviceName}</span>
                          <span>({slo.sli.environment ?? "all"})</span>
                        </div>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() => handleToggleSlo(slo)}
                      className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase transition-colors ${
                        slo.enabled
                          ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                          : "bg-zinc-800 text-zinc-500 border border-zinc-700"
                      }`}
                    >
                      {slo.enabled ? "Active" : "Paused"}
                    </button>
                  </div>

                  {slo.description && (
                    <p className="text-xs text-zinc-400 line-clamp-2">{slo.description}</p>
                  )}

                  {/* Error Budget Radial Gauge & Performance Metric */}
                  <div className="rounded-xl bg-zinc-950 p-4 border border-zinc-800 space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-[10px] uppercase font-semibold text-zinc-500">
                          Current SLI / Target
                        </div>
                        <div className="flex items-baseline gap-1.5 mt-0.5">
                          <span
                            className={`text-lg font-bold ${
                              currentSli >= slo.target.targetPercent
                                ? "text-emerald-400"
                                : "text-rose-400"
                            }`}
                          >
                            {currentSli}%
                          </span>
                          <span className="text-xs text-zinc-500">
                            / {slo.target.targetPercent}%
                          </span>
                        </div>
                      </div>

                      {/* Remaining Error Budget Gauge */}
                      <div className="text-right">
                        <div className="text-[10px] uppercase font-semibold text-zinc-500">
                          Budget Remaining
                        </div>
                        <div
                          className={`text-lg font-extrabold ${
                            remainingBudget > 50
                              ? "text-emerald-400"
                              : remainingBudget > 20
                                ? "text-amber-400"
                                : "text-rose-400"
                          }`}
                        >
                          {remainingBudget}%
                        </div>
                      </div>
                    </div>

                    {/* Visual Progress Bar for Error Budget */}
                    <div className="space-y-1">
                      <div className="h-2 w-full rounded-full bg-zinc-850 overflow-hidden">
                        <div
                          className={`h-full transition-all duration-500 ${
                            remainingBudget > 50
                              ? "bg-gradient-to-r from-emerald-500 to-cyan-400"
                              : remainingBudget > 20
                                ? "bg-gradient-to-r from-amber-500 to-yellow-400"
                                : "bg-gradient-to-r from-rose-600 to-rose-400"
                          }`}
                          style={{ width: `${Math.min(100, remainingBudget)}%` }}
                        />
                      </div>
                      <div className="flex justify-between text-[10px] text-zinc-500">
                        <span>{slo.target.rollingWindowDays}-day rolling window</span>
                        <span>{calc?.totalEventsCount?.toLocaleString() ?? 0} events</span>
                      </div>
                    </div>

                    {/* Burn Rate & Time to Exhaustion */}
                    <div className="flex items-center justify-between pt-2 border-t border-zinc-850 text-xs">
                      <div className="flex items-center gap-1.5 text-zinc-400">
                        <Flame className="h-3.5 w-3.5 text-amber-400" />
                        <span>Burn Rate:</span>
                        <span className="font-bold text-white">{calc?.burnRate1h ?? 0}x</span>
                      </div>
                      <div className="text-zinc-400 text-[11px]">
                        {calc?.estimatedHoursToDepletion ? (
                          <span>~{(calc.estimatedHoursToDepletion / 24).toFixed(1)} days left</span>
                        ) : (
                          <span className="text-emerald-400 font-semibold">Budget Intact</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Actions Bottom Bar */}
                <div className="flex items-center justify-between pt-3 border-t border-zinc-800/80">
                  <Button
                    type="button"
                    onClick={() => handleEvaluateSlo(slo.id)}
                    disabled={evaluatingSloId === slo.id}
                    className="bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs h-8 px-3"
                  >
                    <Play
                      className={`h-3 w-3 mr-1 ${
                        evaluatingSloId === slo.id ? "animate-spin text-cyan-400" : ""
                      }`}
                    />
                    Evaluate SLI
                  </Button>

                  <button
                    type="button"
                    onClick={() => handleDeleteSlo(slo.id)}
                    className="text-zinc-500 hover:text-rose-400 transition-colors p-1.5"
                    title="Delete SLO"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* ========================================================================= */}
      {/* MODAL: CREATE SLO WIZARD */}
      {/* ========================================================================= */}
      {isCreatingSlo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
          <div className="w-full max-w-xl rounded-2xl border border-zinc-800 bg-zinc-900 p-6 shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <div className="flex items-center gap-2">
                <Target className="h-5 w-5 text-emerald-400" />
                <h3 className="text-base font-bold text-white">Create Service Level Objective</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsCreatingSlo(false)}
                className="text-zinc-500 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleCreateSlo} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-zinc-300">Objective Name</label>
                <Input
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="e.g. Core API Availability"
                  className="bg-zinc-950 border-zinc-800 text-white text-xs"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-zinc-300">Description (Optional)</label>
                <Input
                  value={formDesc}
                  onChange={(e) => setFormDesc(e.target.value)}
                  placeholder="e.g. Guarantees 99.9% uptime for payment transactions"
                  className="bg-zinc-950 border-zinc-800 text-white text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-zinc-300">SLI Indicator Type</label>
                  <select
                    value={formSliType}
                    onChange={(e) => setFormSliType(e.target.value as SliType)}
                    className="w-full px-3 py-2 rounded-lg bg-zinc-950 border border-zinc-800 text-xs text-zinc-200 focus:outline-none"
                  >
                    <option value="availability">Availability (No 5xx errors)</option>
                    <option value="latency">Latency (Requests &lt; Threshold ms)</option>
                    <option value="error_rate">Error Rate (&lt; Threshold %)</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-zinc-300">Target Service</label>
                  <Input
                    value={formService}
                    onChange={(e) => setFormService(e.target.value)}
                    placeholder="e.g. po-api-gateway"
                    className="bg-zinc-950 border-zinc-800 text-white text-xs"
                  />
                </div>
              </div>

              {formSliType === "latency" && (
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-zinc-300">Latency Threshold (ms)</label>
                  <Input
                    type="number"
                    value={formLatencyThreshold}
                    onChange={(e) => setFormLatencyThreshold(Number(e.target.value))}
                    className="bg-zinc-950 border-zinc-800 text-white text-xs"
                    required
                  />
                </div>
              )}

              {/* Target & Rolling Window */}
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-zinc-300">Target Objective (%)</label>
                  <Input
                    type="number"
                    step="0.01"
                    min="80"
                    max="99.999"
                    value={formTargetPercent}
                    onChange={(e) => setFormTargetPercent(Number(e.target.value))}
                    className="bg-zinc-950 border-zinc-800 text-white text-xs"
                    required
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-zinc-300">Warning Threshold (%)</label>
                  <Input
                    type="number"
                    step="0.01"
                    min="80"
                    max="99.999"
                    value={formWarningPercent}
                    onChange={(e) => setFormWarningPercent(Number(e.target.value))}
                    className="bg-zinc-950 border-zinc-800 text-white text-xs"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-zinc-300">Window (Days)</label>
                  <select
                    value={formWindowDays}
                    onChange={(e) => setFormWindowDays(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-lg bg-zinc-950 border border-zinc-800 text-xs text-zinc-200 focus:outline-none"
                  >
                    <option value={7}>7 Days (Fast feedback)</option>
                    <option value={30}>30 Days (Standard)</option>
                    <option value={90}>90 Days (Quarterly)</option>
                  </select>
                </div>
              </div>

              {/* Live Preview Box */}
              <div className="rounded-xl bg-zinc-950 p-3 border border-zinc-800 text-xs text-zinc-400 space-y-1">
                <div className="text-[10px] font-semibold uppercase text-emerald-400">
                  SLO Math Preview
                </div>
                <div>
                  Target: <span className="font-bold text-white">{formTargetPercent}%</span> over a{" "}
                  <span className="text-white">{formWindowDays}-day</span> rolling window.
                </div>
                <div>
                  Allowed Error Budget:{" "}
                  <span className="font-bold text-cyan-300">
                    {(100 - formTargetPercent).toFixed(3)}%
                  </span>{" "}
                  unsuccessful events.
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-zinc-800">
                <Button
                  type="button"
                  onClick={() => setIsCreatingSlo(false)}
                  className="bg-zinc-800 text-zinc-300 text-xs"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={isSubmitting}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs"
                >
                  {isSubmitting ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : null}
                  Create Objective
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default SloPage;
