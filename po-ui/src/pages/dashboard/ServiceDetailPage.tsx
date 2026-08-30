import { useEffect, useState } from "react";
import { Link, useNavigate, useOutletContext, useParams } from "react-router-dom";
import {
  Activity,
  AlertTriangle,
  ArrowDownLeft,
  ArrowLeft,
  ArrowUpRight,
  BookOpen,
  Boxes,
  CheckSquare,
  Cpu,
  ExternalLink,
  GitBranch,
  Layers,
  RefreshCw,
  SearchCode,
  Settings,
  ShieldCheck,
  Square,
  Trash2,
  Users,
} from "lucide-react";
import { useToast } from "@/components/ui/toast";
import {
  deleteService,
  getServiceDetail,
  upsertService,
  type ServiceChecklistItem,
  type ServiceDetail,
  type ServiceLanguage,
  type ServiceRuntime,
  type ServiceTier,
} from "@/features/services/api";

type DashboardContextType = {
  selectedProjectId: string | null;
  selectedEnvironment: string;
};

export function ServiceDetailPage() {
  const { serviceName } = useParams<{ serviceName: string }>();
  const navigate = useNavigate();
  const { selectedProjectId } = useOutletContext<DashboardContextType>();
  const { notify } = useToast();

  const [service, setService] = useState<ServiceDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<"overview" | "dependencies" | "errors" | "settings">(
    "overview",
  );

  // Settings form state
  const [formDisplayName, setFormDisplayName] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formOwnerName, setFormOwnerName] = useState("");
  const [formOwnerEmail, setFormOwnerEmail] = useState("");
  const [formOwnerTeam, setFormOwnerTeam] = useState("");
  const [formLanguage, setFormLanguage] = useState<ServiceLanguage>("nodejs");
  const [formRuntime, setFormRuntime] = useState<ServiceRuntime>("docker");
  const [formTier, setFormTier] = useState<ServiceTier>("tier_2");
  const [formRepoUrl, setFormRepoUrl] = useState("");
  const [formRunbookUrl, setFormRunbookUrl] = useState("");
  const [formDeploymentUrl, setFormDeploymentUrl] = useState("");
  const [formTags, setFormTags] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const loadService = async (silent = false) => {
    if (!selectedProjectId || !serviceName) {
      setIsLoading(false);
      return;
    }

    if (!silent) setIsLoading(true);
    else setIsRefreshing(true);

    try {
      const data = await getServiceDetail(selectedProjectId, serviceName);
      setService(data);

      // Populate settings form
      setFormDisplayName(data.displayName || "");
      setFormDescription(data.description || "");
      setFormOwnerName(data.ownerName || "");
      setFormOwnerEmail(data.ownerEmail || "");
      setFormOwnerTeam(data.ownerTeam || "");
      setFormLanguage(data.language);
      setFormRuntime(data.runtime);
      setFormTier(data.tier);
      setFormRepoUrl(data.repoUrl || "");
      setFormRunbookUrl(data.runbookUrl || "");
      setFormDeploymentUrl(data.deploymentUrl || "");
      setFormTags(data.tags.join(", "));
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Service not found";
      notify({ variant: "error", title: "Error", description: msg });
      navigate("/dashboard/services");
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    loadService();
  }, [selectedProjectId, serviceName]);

  const handleToggleChecklist = async (item: ServiceChecklistItem) => {
    if (!service || !selectedProjectId) return;

    const nextChecklist = service.onboardingChecklist.map((c) =>
      c.id === item.id
        ? {
            ...c,
            completed: !c.completed,
            completedAt: !c.completed ? new Date().toISOString() : null,
          }
        : c,
    );

    try {
      await upsertService(selectedProjectId, {
        name: service.name,
        onboardingChecklist: nextChecklist,
      });
      notify({
        variant: "success",
        title: "Checklist Updated",
        description: `Updated step "${item.title}".`,
      });
      loadService(true);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to update checklist";
      notify({ variant: "error", title: "Error", description: msg });
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProjectId || !service) return;

    setIsSaving(true);
    try {
      const tags = formTags
        .split(",")
        .map((t) => t.trim().toLowerCase())
        .filter(Boolean);

      await upsertService(selectedProjectId, {
        name: service.name,
        displayName: formDisplayName.trim() || null,
        description: formDescription.trim() || null,
        ownerName: formOwnerName.trim() || null,
        ownerEmail: formOwnerEmail.trim() || null,
        ownerTeam: formOwnerTeam.trim() || null,
        language: formLanguage,
        runtime: formRuntime,
        tier: formTier,
        repoUrl: formRepoUrl.trim() || null,
        runbookUrl: formRunbookUrl.trim() || null,
        deploymentUrl: formDeploymentUrl.trim() || null,
        tags,
      });

      notify({
        variant: "success",
        title: "Settings Saved",
        description: `Service "${service.name}" configuration updated.`,
      });
      loadService(true);
      setActiveTab("overview");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to save settings";
      notify({ variant: "error", title: "Error", description: msg });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteService = async () => {
    if (!selectedProjectId || !service) return;
    if (!confirm(`Are you sure you want to delete or unregister service "${service.name}"?`))
      return;

    setIsDeleting(true);
    try {
      await deleteService(selectedProjectId, service.name);
      notify({
        variant: "success",
        title: "Service Removed",
        description: `Service "${service.name}" removed from catalog.`,
      });
      navigate("/dashboard/services");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to delete service";
      notify({ variant: "error", title: "Error", description: msg });
      setIsDeleting(false);
    }
  };

  if (isLoading || !service) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-8">
        <RefreshCw className="w-8 h-8 text-indigo-400 animate-spin mb-4" />
        <h2 className="text-base font-semibold text-zinc-300">Loading service details...</h2>
      </div>
    );
  }

  const healthColor =
    service.health.status === "healthy"
      ? "text-emerald-400 border-emerald-500/30 bg-emerald-500/10"
      : service.health.status === "degraded"
        ? "text-amber-400 border-amber-500/30 bg-amber-500/10"
        : "text-rose-400 border-rose-500/30 bg-rose-500/10";

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Top Breadcrumb & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link
            to="/dashboard/services"
            className="p-2 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <div className="flex items-center gap-2 text-xs text-zinc-500">
              <Link to="/dashboard/services" className="hover:text-zinc-300 transition-colors">
                Services
              </Link>
              <span>/</span>
              <span className="text-zinc-300 font-mono">{service.name}</span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-white mt-0.5">
              {service.displayName || service.name}
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {service.runbookUrl && (
            <a
              href={service.runbookUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium bg-zinc-900 hover:bg-zinc-800 text-indigo-300 border border-indigo-500/20 transition-colors"
            >
              <BookOpen className="w-3.5 h-3.5" />
              Runbook
              <ExternalLink className="w-3 h-3 text-indigo-400/60" />
            </a>
          )}
          {service.repoUrl && (
            <a
              href={service.repoUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium bg-zinc-900 hover:bg-zinc-800 text-zinc-200 border border-zinc-800 transition-colors"
            >
              <GitBranch className="w-3.5 h-3.5" />
              Repository
              <ExternalLink className="w-3 h-3 text-zinc-500" />
            </a>
          )}
          <button
            onClick={() => loadService(true)}
            disabled={isRefreshing}
            className="p-2 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors disabled:opacity-50"
            title="Refresh"
          >
            <RefreshCw
              className={`w-4 h-4 ${isRefreshing ? "animate-spin text-indigo-400" : ""}`}
            />
          </button>
        </div>
      </div>

      {/* Hero Service Overview Card */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-zinc-900/90 via-zinc-900/50 to-zinc-950 border border-zinc-800/80 p-6 md:p-8 backdrop-blur-xl shadow-2xl">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-center">
          {/* Left Info */}
          <div className="lg:col-span-2 space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-2.5 py-1 rounded-md text-xs font-semibold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 uppercase tracking-wide">
                {service.tier.replace("_", " ").toUpperCase()}
              </span>
              <span className="px-2.5 py-1 rounded-md text-xs font-medium bg-zinc-800 text-zinc-300 border border-zinc-700/60 uppercase">
                {service.language}
              </span>
              <span className="px-2.5 py-1 rounded-md text-xs font-medium bg-zinc-800 text-zinc-300 border border-zinc-700/60">
                {service.runtime}
              </span>
              {service.isAutoDiscovered && (
                <span className="px-2.5 py-1 rounded-md text-xs font-medium bg-purple-500/10 text-purple-400 border border-purple-500/20">
                  Auto-Discovered
                </span>
              )}
            </div>

            <p className="text-sm text-zinc-300 leading-relaxed max-w-2xl">
              {service.description || "No description provided for this service."}
            </p>

            {/* Owner & Team bar */}
            <div className="flex flex-wrap items-center gap-4 text-xs text-zinc-400 pt-2 border-t border-zinc-800/60">
              <div className="flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-zinc-500" />
                <span className="text-zinc-500">Owner:</span>
                <span className="text-zinc-200 font-medium">
                  {service.ownerName || "Unassigned"}
                </span>
              </div>
              {service.ownerEmail && (
                <div className="flex items-center gap-1.5">
                  <span className="text-zinc-500">Email:</span>
                  <a
                    href={`mailto:${service.ownerEmail}`}
                    className="text-indigo-400 hover:underline"
                  >
                    {service.ownerEmail}
                  </a>
                </div>
              )}
              {service.ownerTeam && (
                <div className="flex items-center gap-1.5">
                  <span className="text-zinc-500">Team:</span>
                  <span className="text-zinc-200 font-medium">{service.ownerTeam}</span>
                </div>
              )}
            </div>
          </div>

          {/* Right Health Gauge Card */}
          <div className="flex flex-col items-center justify-center p-6 rounded-2xl bg-zinc-950/60 border border-zinc-800 text-center">
            <div className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2">
              Service Health Score
            </div>
            <div
              className={`flex items-center justify-center w-24 h-24 rounded-full border-4 ${healthColor} shadow-xl shadow-indigo-500/5 my-1`}
            >
              <div className="text-2xl font-black text-white">{service.health.score}%</div>
            </div>
            <div
              className={`text-xs font-bold uppercase tracking-wider mt-2 ${
                service.health.status === "healthy"
                  ? "text-emerald-400"
                  : service.health.status === "degraded"
                    ? "text-amber-400"
                    : "text-rose-400"
              }`}
            >
              {service.health.status.toUpperCase()}
            </div>
          </div>
        </div>

        {/* 4 Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-6 pt-6 border-t border-zinc-800/60">
          <div className="p-3.5 rounded-xl bg-zinc-950/40 border border-zinc-800/60">
            <div className="text-xs text-zinc-500 font-medium">24h Event Volume</div>
            <div className="text-lg font-bold text-white mt-1">
              {service.stats.totalEvents24h.toLocaleString()}
            </div>
          </div>
          <div className="p-3.5 rounded-xl bg-zinc-950/40 border border-zinc-800/60">
            <div className="text-xs text-zinc-500 font-medium">Error Rate</div>
            <div
              className={`text-lg font-bold mt-1 ${
                service.stats.errorRate24h > 1 ? "text-rose-400" : "text-emerald-400"
              }`}
            >
              {service.stats.errorRate24h}%
            </div>
          </div>
          <div className="p-3.5 rounded-xl bg-zinc-950/40 border border-zinc-800/60">
            <div className="text-xs text-zinc-500 font-medium">P95 Latency</div>
            <div className="text-lg font-bold text-white mt-1">
              {service.stats.p95LatencyMs !== null ? `${service.stats.p95LatencyMs} ms` : "N/A"}
            </div>
          </div>
          <div className="p-3.5 rounded-xl bg-zinc-950/40 border border-zinc-800/60">
            <div className="text-xs text-zinc-500 font-medium">Open Incidents</div>
            <div
              className={`text-lg font-bold mt-1 ${
                service.stats.openIncidentsCount > 0 ? "text-rose-400" : "text-zinc-400"
              }`}
            >
              {service.stats.openIncidentsCount}
            </div>
          </div>
        </div>
      </div>

      {/* Onboarding & Readiness Checklist */}
      <div className="rounded-2xl bg-zinc-900/60 border border-zinc-800/80 p-5 backdrop-blur-md">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-indigo-400" />
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">
              Service Readiness & Onboarding Checklist
            </h3>
          </div>
          <span className="text-xs font-mono text-zinc-400">
            {service.onboardingChecklist.filter((c) => c.completed).length} of{" "}
            {service.onboardingChecklist.length} Complete
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {service.onboardingChecklist.map((item) => (
            <button
              key={item.id}
              onClick={() => handleToggleChecklist(item)}
              className={`flex items-center gap-3 p-3 rounded-xl border text-left transition-all ${
                item.completed
                  ? "bg-emerald-500/5 border-emerald-500/20 text-zinc-200"
                  : "bg-zinc-950/40 border-zinc-800/60 text-zinc-400 hover:border-zinc-700"
              }`}
            >
              {item.completed ? (
                <CheckSquare className="w-4 h-4 text-emerald-400 shrink-0" />
              ) : (
                <Square className="w-4 h-4 text-zinc-500 shrink-0" />
              )}
              <span
                className={`text-xs ${item.completed ? "line-through text-zinc-400" : "font-medium"}`}
              >
                {item.title}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-zinc-800 pb-1">
        {[
          { id: "overview", label: "Health Breakdown", icon: Activity },
          { id: "dependencies", label: "Dependencies Map", icon: Layers },
          { id: "errors", label: "Errors & Incidents", icon: AlertTriangle },
          { id: "settings", label: "Service Settings", icon: Settings },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;

          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as typeof activeTab)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                isActive
                  ? "bg-indigo-600/10 text-indigo-400 border border-indigo-500/20 shadow-sm"
                  : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-850"
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      {activeTab === "overview" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 animate-in fade-in duration-200">
          {/* Health Breakdown Card */}
          <div className="p-6 rounded-2xl bg-zinc-900/60 border border-zinc-800 space-y-4">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <Activity className="w-4 h-4 text-indigo-400" />
              Health Score Factors
            </h3>

            <div className="space-y-3">
              <div>
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="text-zinc-400">Error Rate Penalty (max 40 pts)</span>
                  <span className="font-mono text-rose-400">
                    -{service.health.errorPenalty} pts
                  </span>
                </div>
                <div className="w-full h-1.5 rounded-full bg-zinc-800">
                  <div
                    className="h-full bg-rose-500 rounded-full"
                    style={{ width: `${(service.health.errorPenalty / 40) * 100}%` }}
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="text-zinc-400">Incident Severity Penalty (max 30 pts)</span>
                  <span className="font-mono text-rose-400">
                    -{service.health.incidentPenalty} pts
                  </span>
                </div>
                <div className="w-full h-1.5 rounded-full bg-zinc-800">
                  <div
                    className="h-full bg-rose-500 rounded-full"
                    style={{ width: `${(service.health.incidentPenalty / 30) * 100}%` }}
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="text-zinc-400">Latency SLA Deficit (max 20 pts)</span>
                  <span className="font-mono text-amber-400">
                    -{service.health.latencyPenalty} pts
                  </span>
                </div>
                <div className="w-full h-1.5 rounded-full bg-zinc-800">
                  <div
                    className="h-full bg-amber-500 rounded-full"
                    style={{ width: `${(service.health.latencyPenalty / 20) * 100}%` }}
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="text-zinc-400">Onboarding Readiness Score (max 10 pts)</span>
                  <span className="font-mono text-emerald-400">
                    +{service.health.readinessScore} pts
                  </span>
                </div>
                <div className="w-full h-1.5 rounded-full bg-zinc-800">
                  <div
                    className="h-full bg-emerald-500 rounded-full"
                    style={{ width: `${(service.health.readinessScore / 10) * 100}%` }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Quick Context Links */}
          <div className="p-6 rounded-2xl bg-zinc-900/60 border border-zinc-800 space-y-4">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <Boxes className="w-4 h-4 text-indigo-400" />
              Service Quick Actions
            </h3>

            <div className="grid grid-cols-1 gap-2.5">
              <Link
                to={`/dashboard/logs?source=${service.name}`}
                className="flex items-center justify-between p-3 rounded-xl bg-zinc-950/60 border border-zinc-800 hover:border-indigo-500/40 text-xs text-zinc-200 transition-colors"
              >
                <div className="flex items-center gap-2.5">
                  <SearchCode className="w-4 h-4 text-indigo-400" />
                  <span>Inspect Live Logs for {service.name}</span>
                </div>
                <ArrowUpRight className="w-3.5 h-3.5 text-zinc-500" />
              </Link>

              <Link
                to={`/dashboard/metrics?source=${service.name}`}
                className="flex items-center justify-between p-3 rounded-xl bg-zinc-950/60 border border-zinc-800 hover:border-indigo-500/40 text-xs text-zinc-200 transition-colors"
              >
                <div className="flex items-center gap-2.5">
                  <Activity className="w-4 h-4 text-emerald-400" />
                  <span>View Telemetry Metrics & Latency</span>
                </div>
                <ArrowUpRight className="w-3.5 h-3.5 text-zinc-500" />
              </Link>

              <Link
                to={`/dashboard/traces?source=${service.name}`}
                className="flex items-center justify-between p-3 rounded-xl bg-zinc-950/60 border border-zinc-800 hover:border-indigo-500/40 text-xs text-zinc-200 transition-colors"
              >
                <div className="flex items-center gap-2.5">
                  <Cpu className="w-4 h-4 text-amber-400" />
                  <span>Trace Spans & Performance Graph</span>
                </div>
                <ArrowUpRight className="w-3.5 h-3.5 text-zinc-500" />
              </Link>

              <Link
                to={`/dashboard/alerts`}
                className="flex items-center justify-between p-3 rounded-xl bg-zinc-950/60 border border-zinc-800 hover:border-indigo-500/40 text-xs text-zinc-200 transition-colors"
              >
                <div className="flex items-center gap-2.5">
                  <AlertTriangle className="w-4 h-4 text-rose-400" />
                  <span>Active Incidents & Pager Routing</span>
                </div>
                <ArrowUpRight className="w-3.5 h-3.5 text-zinc-500" />
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Tab: Dependencies */}
      {activeTab === "dependencies" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 animate-in fade-in duration-200">
          {/* Inbound Callers */}
          <div className="p-6 rounded-2xl bg-zinc-900/60 border border-zinc-800 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <ArrowDownLeft className="w-4 h-4 text-cyan-400" />
                Inbound Upstream Callers ({service.dependencies.inbound.length})
              </h3>
            </div>

            {service.dependencies.inbound.length === 0 ? (
              <div className="p-8 text-center rounded-xl bg-zinc-950/40 border border-zinc-850 text-zinc-500 text-xs">
                No inbound caller dependencies detected in recent trace windows.
              </div>
            ) : (
              <div className="space-y-2">
                {service.dependencies.inbound.map((edge) => (
                  <div
                    key={edge.service}
                    className="flex items-center justify-between p-3 rounded-xl bg-zinc-950/60 border border-zinc-800"
                  >
                    <div>
                      <Link
                        to={`/dashboard/services/${edge.service}`}
                        className="text-xs font-semibold text-white hover:text-indigo-400 transition-colors"
                      >
                        {edge.service}
                      </Link>
                      <div className="text-[10px] text-zinc-500">Calls this service</div>
                    </div>
                    <div className="flex items-center gap-3 text-right">
                      <div>
                        <div className="text-xs font-mono font-medium text-zinc-300">
                          {edge.callCount} calls
                        </div>
                        <div className="text-[10px] text-zinc-500">{edge.avgLatencyMs}ms avg</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Outbound Dependencies */}
          <div className="p-6 rounded-2xl bg-zinc-900/60 border border-zinc-800 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <ArrowUpRight className="w-4 h-4 text-indigo-400" />
                Outbound Downstream Dependencies ({service.dependencies.outbound.length})
              </h3>
            </div>

            {service.dependencies.outbound.length === 0 ? (
              <div className="p-8 text-center rounded-xl bg-zinc-950/40 border border-zinc-850 text-zinc-500 text-xs">
                No outbound dependencies detected in recent trace windows.
              </div>
            ) : (
              <div className="space-y-2">
                {service.dependencies.outbound.map((edge) => (
                  <div
                    key={edge.service}
                    className="flex items-center justify-between p-3 rounded-xl bg-zinc-950/60 border border-zinc-800"
                  >
                    <div>
                      <Link
                        to={`/dashboard/services/${edge.service}`}
                        className="text-xs font-semibold text-white hover:text-indigo-400 transition-colors"
                      >
                        {edge.service}
                      </Link>
                      <div className="text-[10px] text-zinc-500">Invoked by this service</div>
                    </div>
                    <div className="flex items-center gap-3 text-right">
                      <div>
                        <div className="text-xs font-mono font-medium text-zinc-300">
                          {edge.callCount} calls
                        </div>
                        <div className="text-[10px] text-zinc-500">{edge.avgLatencyMs}ms avg</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab: Errors & Incidents */}
      {activeTab === "errors" && (
        <div className="space-y-5 animate-in fade-in duration-200">
          {/* Recent Incidents */}
          <div className="p-6 rounded-2xl bg-zinc-900/60 border border-zinc-800 space-y-4">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-400" />
              Service Incidents ({service.recentIncidents.length})
            </h3>

            {service.recentIncidents.length === 0 ? (
              <div className="p-8 text-center rounded-xl bg-zinc-950/40 border border-zinc-850 text-zinc-500 text-xs">
                No incidents reported for this service.
              </div>
            ) : (
              <div className="space-y-2.5">
                {service.recentIncidents.map((inc) => (
                  <div
                    key={inc.id}
                    className="flex items-center justify-between p-3.5 rounded-xl bg-zinc-950/60 border border-zinc-800 text-xs"
                  >
                    <div>
                      <div className="font-semibold text-white">{inc.title}</div>
                      <div className="text-[11px] text-zinc-500 mt-0.5">
                        Created {new Date(inc.createdAt).toLocaleString()}
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                          inc.severity === "critical"
                            ? "bg-rose-500/10 text-rose-400 border border-rose-500/20"
                            : "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                        }`}
                      >
                        {inc.severity}
                      </span>
                      <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-zinc-800 text-zinc-300">
                        {inc.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Grouped Errors */}
          <div className="p-6 rounded-2xl bg-zinc-900/60 border border-zinc-800 space-y-4">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-amber-400" />
              Recent Error Signatures ({service.recentErrors.length})
            </h3>

            {service.recentErrors.length === 0 ? (
              <div className="p-8 text-center rounded-xl bg-zinc-950/40 border border-zinc-850 text-zinc-500 text-xs">
                No active error signatures for this service.
              </div>
            ) : (
              <div className="space-y-2.5">
                {service.recentErrors.map((err) => (
                  <div
                    key={err.id}
                    className="p-3 rounded-xl bg-zinc-950/60 border border-zinc-800 text-xs space-y-1"
                  >
                    <div className="flex items-center justify-between font-mono text-zinc-300">
                      <span className="truncate">{err.message || err.fingerprint}</span>
                      <span className="text-amber-400 font-bold ml-2 shrink-0">{err.count}x</span>
                    </div>
                    <div className="text-[10px] text-zinc-500">
                      Last seen: {new Date(err.observedAt).toLocaleString()}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab: Settings */}
      {activeTab === "settings" && (
        <div className="p-6 md:p-8 rounded-2xl bg-zinc-900/60 border border-zinc-800 animate-in fade-in duration-200">
          <form onSubmit={handleSaveSettings} className="space-y-5 max-w-3xl">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1">
                  Display Name
                </label>
                <input
                  type="text"
                  value={formDisplayName}
                  onChange={(e) => setFormDisplayName(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-lg bg-zinc-950 border border-zinc-800 text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1">
                  Criticality Tier
                </label>
                <select
                  value={formTier}
                  onChange={(e) => setFormTier(e.target.value as ServiceTier)}
                  className="w-full px-3 py-2 text-sm rounded-lg bg-zinc-950 border border-zinc-800 text-white focus:outline-none focus:border-indigo-500"
                >
                  <option value="tier_1">Tier 1 - Mission Critical</option>
                  <option value="tier_2">Tier 2 - Business Standard</option>
                  <option value="tier_3">Tier 3 - Supporting</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-300 mb-1">Description</label>
              <textarea
                rows={2}
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-lg bg-zinc-950 border border-zinc-800 text-white focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1">Language</label>
                <select
                  value={formLanguage}
                  onChange={(e) => setFormLanguage(e.target.value as ServiceLanguage)}
                  className="w-full px-3 py-2 text-sm rounded-lg bg-zinc-950 border border-zinc-800 text-white focus:outline-none focus:border-indigo-500"
                >
                  <option value="nodejs">Node.js / TypeScript</option>
                  <option value="python">Python</option>
                  <option value="go">Go</option>
                  <option value="java">Java</option>
                  <option value="rust">Rust</option>
                  <option value="csharp">C#</option>
                  <option value="ruby">Ruby</option>
                  <option value="other">Other</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1">Runtime</label>
                <select
                  value={formRuntime}
                  onChange={(e) => setFormRuntime(e.target.value as ServiceRuntime)}
                  className="w-full px-3 py-2 text-sm rounded-lg bg-zinc-950 border border-zinc-800 text-white focus:outline-none focus:border-indigo-500"
                >
                  <option value="docker">Docker Container</option>
                  <option value="kubernetes">Kubernetes Pod</option>
                  <option value="lambda">AWS Lambda</option>
                  <option value="cloud_run">Google Cloud Run</option>
                  <option value="ecs">AWS ECS</option>
                  <option value="baremetal">Bare Metal</option>
                  <option value="other">Other</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1">Tags</label>
                <input
                  type="text"
                  value={formTags}
                  onChange={(e) => setFormTags(e.target.value)}
                  placeholder="core, payments, tier-1"
                  className="w-full px-3 py-2 text-sm rounded-lg bg-zinc-950 border border-zinc-800 text-white focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>

            {/* Ownership Section */}
            <div className="pt-3 border-t border-zinc-800/60">
              <h4 className="text-xs font-bold text-zinc-200 uppercase tracking-wider mb-3">
                Ownership & Team
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-zinc-400 mb-1">
                    Owner Name
                  </label>
                  <input
                    type="text"
                    value={formOwnerName}
                    onChange={(e) => setFormOwnerName(e.target.value)}
                    className="w-full px-3 py-2 text-sm rounded-lg bg-zinc-950 border border-zinc-800 text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-zinc-400 mb-1">
                    Owner Email
                  </label>
                  <input
                    type="email"
                    value={formOwnerEmail}
                    onChange={(e) => setFormOwnerEmail(e.target.value)}
                    className="w-full px-3 py-2 text-sm rounded-lg bg-zinc-950 border border-zinc-800 text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-zinc-400 mb-1">
                    Squad / Team
                  </label>
                  <input
                    type="text"
                    value={formOwnerTeam}
                    onChange={(e) => setFormOwnerTeam(e.target.value)}
                    className="w-full px-3 py-2 text-sm rounded-lg bg-zinc-950 border border-zinc-800 text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>
            </div>

            {/* Links Section */}
            <div className="pt-3 border-t border-zinc-800/60">
              <h4 className="text-xs font-bold text-zinc-200 uppercase tracking-wider mb-3">
                Repository & Documentation Links
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-zinc-400 mb-1">
                    Git Repo URL
                  </label>
                  <input
                    type="url"
                    value={formRepoUrl}
                    onChange={(e) => setFormRepoUrl(e.target.value)}
                    className="w-full px-3 py-2 text-sm rounded-lg bg-zinc-950 border border-zinc-800 text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-zinc-400 mb-1">
                    Runbook URL
                  </label>
                  <input
                    type="url"
                    value={formRunbookUrl}
                    onChange={(e) => setFormRunbookUrl(e.target.value)}
                    className="w-full px-3 py-2 text-sm rounded-lg bg-zinc-950 border border-zinc-800 text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-zinc-400 mb-1">
                    Deployment URL
                  </label>
                  <input
                    type="url"
                    value={formDeploymentUrl}
                    onChange={(e) => setFormDeploymentUrl(e.target.value)}
                    className="w-full px-3 py-2 text-sm rounded-lg bg-zinc-950 border border-zinc-800 text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>
            </div>

            {/* Submit & Danger Zone */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-6 border-t border-zinc-800">
              <button
                type="button"
                onClick={handleDeleteService}
                disabled={isDeleting}
                className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 transition-colors disabled:opacity-50"
              >
                <Trash2 className="w-3.5 h-3.5" />
                {isDeleting ? "Deleting..." : "Delete Service"}
              </button>

              <div className="flex items-center gap-3">
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-5 py-2 text-sm font-semibold rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/20 transition-all disabled:opacity-50"
                >
                  {isSaving ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
