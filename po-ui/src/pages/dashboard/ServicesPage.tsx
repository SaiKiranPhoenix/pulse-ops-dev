import { useEffect, useMemo, useState } from "react";
import { Link, useOutletContext } from "react-router-dom";
import {
  Activity,
  AlertTriangle,
  ArrowUpRight,
  BookOpen,
  Boxes,
  CheckCircle2,
  GitBranch,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  Sparkles,
  Tag,
  Users,
  X,
} from "lucide-react";
import { useToast } from "@/components/ui/toast";
import {
  listServices,
  upsertService,
  type ServiceCatalogItem,
  type ServiceLanguage,
  type ServiceRuntime,
  type ServiceTier,
} from "@/features/services/api";

type DashboardContextType = {
  selectedProjectId: string | null;
  selectedEnvironment: string;
};

const LANGUAGE_LABELS: Record<ServiceLanguage, { label: string; color: string }> = {
  nodejs: { label: "Node.js", color: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" },
  python: { label: "Python", color: "bg-amber-500/10 text-amber-400 border-amber-500/20" },
  go: { label: "Go", color: "bg-cyan-500/10 text-cyan-400 border-cyan-500/20" },
  java: { label: "Java", color: "bg-orange-500/10 text-orange-400 border-orange-500/20" },
  rust: { label: "Rust", color: "bg-red-500/10 text-red-400 border-red-500/20" },
  csharp: { label: "C#", color: "bg-purple-500/10 text-purple-400 border-purple-500/20" },
  ruby: { label: "Ruby", color: "bg-rose-500/10 text-rose-400 border-rose-500/20" },
  other: { label: "Other", color: "bg-zinc-500/10 text-zinc-400 border-zinc-500/20" },
};

const TIER_BADGES: Record<
  ServiceTier,
  { label: string; bg: string; text: string; border: string }
> = {
  tier_1: {
    label: "Tier 1 - Mission Critical",
    bg: "bg-rose-500/10",
    text: "text-rose-400",
    border: "border-rose-500/20",
  },
  tier_2: {
    label: "Tier 2 - Business Standard",
    bg: "bg-blue-500/10",
    text: "text-blue-400",
    border: "border-blue-500/20",
  },
  tier_3: {
    label: "Tier 3 - Supporting",
    bg: "bg-zinc-500/10",
    text: "text-zinc-400",
    border: "border-zinc-500/20",
  },
};

export function ServicesPage() {
  const { selectedProjectId } = useOutletContext<DashboardContextType>();
  const { notify } = useToast();

  const [services, setServices] = useState<ServiceCatalogItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTier, setSelectedTier] = useState<string>("all");
  const [selectedStatus, setSelectedStatus] = useState<string>("all");
  const [selectedTag, setSelectedTag] = useState<string>("all");
  const [viewMode, setViewMode] = useState<"grid" | "table">("grid");

  // Modal State
  const [isRegisterOpen, setIsRegisterOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formName, setFormName] = useState("");
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

  const loadCatalog = async (silent = false) => {
    if (!selectedProjectId) {
      setServices([]);
      setIsLoading(false);
      return;
    }

    if (!silent) setIsLoading(true);
    else setIsRefreshing(true);

    try {
      const data = await listServices(selectedProjectId);
      setServices(data);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to load services";
      notify({ variant: "error", title: "Service Catalog Error", description: msg });
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    loadCatalog();
  }, [selectedProjectId]);

  const handleRegisterService = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProjectId || !formName.trim()) return;

    setIsSubmitting(true);
    try {
      const tags = formTags
        .split(",")
        .map((t) => t.trim().toLowerCase())
        .filter(Boolean);

      await upsertService(selectedProjectId, {
        name: formName.trim().toLowerCase(),
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
        title: "Service Registered",
        description: `Service "${formName}" added to catalog.`,
      });

      setIsRegisterOpen(false);
      resetForm();
      loadCatalog(true);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Registration failed";
      notify({ variant: "error", title: "Error", description: msg });
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    setFormName("");
    setFormDisplayName("");
    setFormDescription("");
    setFormOwnerName("");
    setFormOwnerEmail("");
    setFormOwnerTeam("");
    setFormLanguage("nodejs");
    setFormRuntime("docker");
    setFormTier("tier_2");
    setFormRepoUrl("");
    setFormRunbookUrl("");
    setFormDeploymentUrl("");
    setFormTags("");
  };

  // Collect all distinct tags across services
  const allTags = useMemo(() => {
    const set = new Set<string>();
    for (const s of services) {
      for (const t of s.tags) set.add(t);
    }
    return Array.from(set).sort();
  }, [services]);

  // Filtered services
  const filteredServices = useMemo(() => {
    return services.filter((s) => {
      const matchesSearch =
        s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (s.displayName && s.displayName.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (s.ownerName && s.ownerName.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (s.ownerTeam && s.ownerTeam.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchesTier = selectedTier === "all" || s.tier === selectedTier;
      const matchesStatus = selectedStatus === "all" || s.status === selectedStatus;
      const matchesTag = selectedTag === "all" || s.tags.includes(selectedTag);

      return matchesSearch && matchesTier && matchesStatus && matchesTag;
    });
  }, [services, searchQuery, selectedTier, selectedStatus, selectedTag]);

  // Aggregate stats
  const stats = useMemo(() => {
    const total = services.length;
    const healthy = services.filter((s) => s.health.status === "healthy").length;
    const degradedOrCrit = services.filter(
      (s) => s.health.status === "degraded" || s.health.status === "critical",
    ).length;
    const autoDiscovered = services.filter((s) => s.isAutoDiscovered).length;
    const tier1Count = services.filter((s) => s.tier === "tier_1").length;

    return { total, healthy, degradedOrCrit, autoDiscovered, tier1Count };
  }, [services]);

  if (!selectedProjectId) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-8">
        <Boxes className="w-12 h-12 text-zinc-600 mb-4 animate-pulse" />
        <h2 className="text-xl font-semibold text-zinc-200 mb-2">No Project Selected</h2>
        <p className="text-sm text-zinc-400 max-w-md">
          Please select or create a project to view and manage its Service Catalog.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Hero Header */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-zinc-900/90 via-zinc-900/50 to-zinc-950 border border-zinc-800/80 p-6 md:p-8 backdrop-blur-xl shadow-2xl">
        <div className="absolute top-0 right-0 -mt-8 -mr-8 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-1/3 -mb-8 w-64 h-64 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              <Boxes className="w-3.5 h-3.5" />
              Service Catalog & Ownership Engine
            </div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-white">
              Service Registry & Health
            </h1>
            <p className="text-sm text-zinc-400 max-w-2xl">
              Centralized service metadata, automatic telemetry discovery, continuous health
              scoring, ownership tracking, and dependency topologies.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => loadCatalog(true)}
              disabled={isRefreshing || isLoading}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium bg-zinc-800/80 hover:bg-zinc-800 text-zinc-200 border border-zinc-700/60 transition-all hover:border-zinc-600 disabled:opacity-50"
            >
              <RefreshCw
                className={`w-4 h-4 ${isRefreshing ? "animate-spin text-indigo-400" : ""}`}
              />
              Refresh
            </button>
            <button
              onClick={() => {
                resetForm();
                setIsRegisterOpen(true);
              }}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/20 transition-all active:scale-[0.98]"
            >
              <Plus className="w-4 h-4" />
              Register Service
            </button>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mt-6 pt-6 border-t border-zinc-800/60">
          <div className="p-3.5 rounded-xl bg-zinc-950/40 border border-zinc-800/60">
            <div className="text-xs text-zinc-500 font-medium">Total Services</div>
            <div className="text-xl font-bold text-white mt-1">{stats.total}</div>
          </div>
          <div className="p-3.5 rounded-xl bg-zinc-950/40 border border-zinc-800/60">
            <div className="text-xs text-emerald-400 font-medium flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5" />
              Healthy (&gt;=90)
            </div>
            <div className="text-xl font-bold text-emerald-400 mt-1">{stats.healthy}</div>
          </div>
          <div className="p-3.5 rounded-xl bg-zinc-950/40 border border-zinc-800/60">
            <div className="text-xs text-amber-400 font-medium flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5" />
              At-Risk / Degraded
            </div>
            <div className="text-xl font-bold text-amber-400 mt-1">{stats.degradedOrCrit}</div>
          </div>
          <div className="p-3.5 rounded-xl bg-zinc-950/40 border border-zinc-800/60">
            <div className="text-xs text-indigo-400 font-medium flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5" />
              Auto-Discovered
            </div>
            <div className="text-xl font-bold text-indigo-400 mt-1">{stats.autoDiscovered}</div>
          </div>
          <div className="p-3.5 rounded-xl bg-zinc-950/40 border border-zinc-800/60">
            <div className="text-xs text-rose-400 font-medium flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5" />
              Tier 1 Critical
            </div>
            <div className="text-xl font-bold text-rose-400 mt-1">{stats.tier1Count}</div>
          </div>
        </div>
      </div>

      {/* Filter & Toolbar */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 p-4 rounded-xl bg-zinc-900/60 border border-zinc-800/80 backdrop-blur-md">
        <div className="flex flex-wrap items-center gap-3 flex-1">
          {/* Search Box */}
          <div className="relative flex-1 min-w-[220px]">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by name, owner, team..."
              className="w-full pl-9 pr-8 py-2 text-sm rounded-lg bg-zinc-950/60 border border-zinc-800 text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-indigo-500 transition-colors"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Tier Selector */}
          <div className="flex items-center rounded-lg bg-zinc-950/60 border border-zinc-800 p-0.5">
            {["all", "tier_1", "tier_2", "tier_3"].map((tier) => (
              <button
                key={tier}
                onClick={() => setSelectedTier(tier)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                  selectedTier === tier
                    ? "bg-zinc-800 text-white shadow-sm"
                    : "text-zinc-400 hover:text-zinc-200"
                }`}
              >
                {tier === "all" ? "All Tiers" : tier.replace("_", " ").toUpperCase()}
              </button>
            ))}
          </div>

          {/* Tag Selector */}
          {allTags.length > 0 && (
            <div className="flex items-center gap-1.5 text-xs">
              <Tag className="w-3.5 h-3.5 text-zinc-500" />
              <select
                value={selectedTag}
                onChange={(e) => setSelectedTag(e.target.value)}
                className="px-2.5 py-1.5 rounded-lg bg-zinc-950/60 border border-zinc-800 text-zinc-300 text-xs focus:outline-none focus:border-indigo-500"
              >
                <option value="all">All Tags</option>
                {allTags.map((tag) => (
                  <option key={tag} value={tag}>
                    #{tag}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* View Toggle */}
        <div className="flex items-center gap-1 border border-zinc-800 rounded-lg p-0.5 bg-zinc-950/60">
          <button
            onClick={() => setViewMode("grid")}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
              viewMode === "grid" ? "bg-zinc-800 text-white" : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            Grid
          </button>
          <button
            onClick={() => setViewMode("table")}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
              viewMode === "table" ? "bg-zinc-800 text-white" : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            Table
          </button>
        </div>
      </div>

      {/* Content View */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-20">
          <RefreshCw className="w-8 h-8 text-indigo-400 animate-spin mb-3" />
          <p className="text-sm text-zinc-400">Loading service registry...</p>
        </div>
      ) : filteredServices.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-12 text-center rounded-2xl bg-zinc-900/30 border border-zinc-800/80">
          <Boxes className="w-12 h-12 text-zinc-600 mb-3" />
          <h3 className="text-base font-semibold text-zinc-300">No Services Found</h3>
          <p className="text-sm text-zinc-500 max-w-sm mt-1">
            {searchQuery || selectedTier !== "all" || selectedTag !== "all"
              ? "No services match your filters. Try clearing or relaxing search criteria."
              : "No services are currently registered or discovered in this project."}
          </p>
        </div>
      ) : viewMode === "grid" ? (
        /* Grid Cards View */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredServices.map((service) => {
            const healthColor =
              service.health.status === "healthy"
                ? "text-emerald-400 border-emerald-500/30 bg-emerald-500/10"
                : service.health.status === "degraded"
                  ? "text-amber-400 border-amber-500/30 bg-amber-500/10"
                  : "text-rose-400 border-rose-500/30 bg-rose-500/10";

            const completedChecklist = service.onboardingChecklist.filter(
              (c) => c.completed,
            ).length;
            const totalChecklist = service.onboardingChecklist.length || 5;

            return (
              <div
                key={service.id}
                className="group relative flex flex-col justify-between rounded-2xl bg-gradient-to-b from-zinc-900/90 to-zinc-950/80 border border-zinc-800/80 hover:border-indigo-500/40 p-5 backdrop-blur-sm transition-all duration-200 hover:shadow-xl hover:shadow-indigo-500/5 hover:-translate-y-0.5"
              >
                <div>
                  {/* Top Badges */}
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span
                        className={`px-2 py-0.5 rounded-md text-[11px] font-medium border ${TIER_BADGES[service.tier]?.bg} ${TIER_BADGES[service.tier]?.text} ${TIER_BADGES[service.tier]?.border}`}
                      >
                        {service.tier.replace("_", " ").toUpperCase()}
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded-md text-[11px] font-medium border ${LANGUAGE_LABELS[service.language]?.color}`}
                      >
                        {LANGUAGE_LABELS[service.language]?.label}
                      </span>
                      {service.isAutoDiscovered && (
                        <span className="px-2 py-0.5 rounded-md text-[11px] font-medium bg-purple-500/10 text-purple-400 border border-purple-500/20">
                          Auto-Detected
                        </span>
                      )}
                    </div>

                    {/* Health Score Badge */}
                    <div
                      className={`flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-bold border ${healthColor}`}
                    >
                      <Activity className="w-3.5 h-3.5" />
                      <span>{service.health.score}%</span>
                    </div>
                  </div>

                  {/* Title & Description */}
                  <Link
                    to={`/dashboard/services/${service.name}`}
                    className="block group-hover:text-indigo-400 transition-colors"
                  >
                    <h3 className="text-base font-semibold text-white tracking-tight">
                      {service.displayName || service.name}
                    </h3>
                    <p className="text-xs text-zinc-500 font-mono mt-0.5">{service.name}</p>
                  </Link>

                  <p className="text-xs text-zinc-400 line-clamp-2 mt-2 leading-relaxed">
                    {service.description || "No description provided."}
                  </p>

                  {/* Owner & Team */}
                  <div className="flex items-center gap-2 mt-3 pt-3 border-t border-zinc-800/60 text-xs text-zinc-400">
                    <Users className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
                    {service.ownerName || service.ownerTeam ? (
                      <span className="truncate">
                        {service.ownerName}
                        {service.ownerTeam && ` (${service.ownerTeam})`}
                      </span>
                    ) : (
                      <span className="text-amber-500/80 font-medium">Unassigned Owner</span>
                    )}
                  </div>

                  {/* Tags */}
                  {service.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2.5">
                      {service.tags.slice(0, 4).map((tag) => (
                        <span
                          key={tag}
                          className="px-2 py-0.5 text-[10px] rounded bg-zinc-950 text-zinc-400 border border-zinc-800/80"
                        >
                          #{tag}
                        </span>
                      ))}
                      {service.tags.length > 4 && (
                        <span className="text-[10px] text-zinc-500">
                          +{service.tags.length - 4}
                        </span>
                      )}
                    </div>
                  )}

                  {/* Metrics Snapshot */}
                  <div className="grid grid-cols-3 gap-2 mt-4 p-2.5 rounded-xl bg-zinc-950/60 border border-zinc-850 text-center">
                    <div>
                      <div className="text-[10px] text-zinc-500">24h Events</div>
                      <div className="text-xs font-semibold text-zinc-200 mt-0.5">
                        {service.stats.totalEvents24h.toLocaleString()}
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] text-zinc-500">Error Rate</div>
                      <div
                        className={`text-xs font-semibold mt-0.5 ${
                          service.stats.errorRate24h > 1 ? "text-rose-400" : "text-emerald-400"
                        }`}
                      >
                        {service.stats.errorRate24h}%
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] text-zinc-500">Incidents</div>
                      <div
                        className={`text-xs font-semibold mt-0.5 ${
                          service.stats.openIncidentsCount > 0 ? "text-rose-400" : "text-zinc-400"
                        }`}
                      >
                        {service.stats.openIncidentsCount}
                      </div>
                    </div>
                  </div>

                  {/* Onboarding Checklist progress */}
                  <div className="mt-3">
                    <div className="flex items-center justify-between text-[11px] text-zinc-500 mb-1">
                      <span>Readiness Checklist</span>
                      <span className="font-mono">
                        {completedChecklist}/{totalChecklist}
                      </span>
                    </div>
                    <div className="w-full h-1.5 rounded-full bg-zinc-800 overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-indigo-500 to-emerald-400 transition-all duration-300"
                        style={{
                          width: `${(completedChecklist / totalChecklist) * 100}%`,
                        }}
                      />
                    </div>
                  </div>
                </div>

                {/* Bottom Actions */}
                <div className="flex items-center justify-between gap-2 mt-4 pt-3 border-t border-zinc-800/80">
                  <div className="flex items-center gap-2">
                    {service.runbookUrl && (
                      <a
                        href={service.runbookUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="p-1.5 text-zinc-400 hover:text-indigo-400 transition-colors"
                        title="View Runbook"
                      >
                        <BookOpen className="w-4 h-4" />
                      </a>
                    )}
                    {service.repoUrl && (
                      <a
                        href={service.repoUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="p-1.5 text-zinc-400 hover:text-white transition-colors"
                        title="View Repository"
                      >
                        <GitBranch className="w-4 h-4" />
                      </a>
                    )}
                  </div>

                  <Link
                    to={`/dashboard/services/${service.name}`}
                    className="inline-flex items-center gap-1 text-xs font-medium text-indigo-400 hover:text-indigo-300 transition-colors"
                  >
                    View Details
                    <ArrowUpRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* Table View */
        <div className="overflow-x-auto rounded-xl border border-zinc-800 bg-zinc-900/60 backdrop-blur-sm">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-zinc-800 bg-zinc-950/60 text-zinc-400">
                <th className="py-3 px-4 font-semibold">Service</th>
                <th className="py-3 px-4 font-semibold">Tier</th>
                <th className="py-3 px-4 font-semibold">Language</th>
                <th className="py-3 px-4 font-semibold">Owner</th>
                <th className="py-3 px-4 font-semibold">Health Score</th>
                <th className="py-3 px-4 font-semibold">24h Events</th>
                <th className="py-3 px-4 font-semibold">Error Rate</th>
                <th className="py-3 px-4 font-semibold">Open Incidents</th>
                <th className="py-3 px-4 font-semibold text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/60">
              {filteredServices.map((service) => {
                const healthColor =
                  service.health.status === "healthy"
                    ? "text-emerald-400"
                    : service.health.status === "degraded"
                      ? "text-amber-400"
                      : "text-rose-400";

                return (
                  <tr key={service.id} className="hover:bg-zinc-800/40 transition-colors group">
                    <td className="py-3 px-4">
                      <Link
                        to={`/dashboard/services/${service.name}`}
                        className="font-medium text-zinc-100 group-hover:text-indigo-400 transition-colors"
                      >
                        {service.displayName || service.name}
                      </Link>
                      <div className="text-[11px] text-zinc-500 font-mono">{service.name}</div>
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-medium border ${TIER_BADGES[service.tier]?.bg} ${TIER_BADGES[service.tier]?.text} ${TIER_BADGES[service.tier]?.border}`}
                      >
                        {service.tier.replace("_", " ").toUpperCase()}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <span className="text-zinc-300">
                        {LANGUAGE_LABELS[service.language]?.label}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-zinc-300">
                      {service.ownerName || service.ownerTeam || (
                        <span className="text-amber-500">Unassigned</span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <span className={`font-bold ${healthColor}`}>{service.health.score}%</span>
                    </td>
                    <td className="py-3 px-4 text-zinc-300 font-mono">
                      {service.stats.totalEvents24h.toLocaleString()}
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`font-semibold ${
                          service.stats.errorRate24h > 1 ? "text-rose-400" : "text-emerald-400"
                        }`}
                      >
                        {service.stats.errorRate24h}%
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`font-semibold ${
                          service.stats.openIncidentsCount > 0 ? "text-rose-400" : "text-zinc-400"
                        }`}
                      >
                        {service.stats.openIncidentsCount}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <Link
                        to={`/dashboard/services/${service.name}`}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs transition-colors"
                      >
                        Explore
                        <ArrowUpRight className="w-3 h-3" />
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Register Service Modal */}
      {isRegisterOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-in fade-in duration-200">
          <div className="relative w-full max-w-2xl rounded-2xl bg-zinc-900 border border-zinc-800 p-6 md:p-8 shadow-2xl overflow-y-auto max-h-[90vh]">
            <div className="flex items-center justify-between pb-4 border-b border-zinc-800">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                  <Boxes className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">Register New Service</h3>
                  <p className="text-xs text-zinc-400">
                    Add service metadata, ownership, and links
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsRegisterOpen(false)}
                className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleRegisterService} className="space-y-4 mt-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-zinc-300 mb-1">
                    Service Identifier (Slug) *
                  </label>
                  <input
                    type="text"
                    required
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    placeholder="e.g. checkout-api"
                    className="w-full px-3 py-2 text-sm rounded-lg bg-zinc-950 border border-zinc-800 text-white placeholder-zinc-600 focus:outline-none focus:border-indigo-500"
                  />
                  <p className="text-[11px] text-zinc-500 mt-1">
                    Must match telemetry source name.
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-zinc-300 mb-1">
                    Display Name
                  </label>
                  <input
                    type="text"
                    value={formDisplayName}
                    onChange={(e) => setFormDisplayName(e.target.value)}
                    placeholder="e.g. Checkout & Payments API"
                    className="w-full px-3 py-2 text-sm rounded-lg bg-zinc-950 border border-zinc-800 text-white placeholder-zinc-600 focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1">
                  Description
                </label>
                <textarea
                  rows={2}
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  placeholder="Primary service responsible for basket calculations and Stripe gateway integration."
                  className="w-full px-3 py-2 text-sm rounded-lg bg-zinc-950 border border-zinc-800 text-white placeholder-zinc-600 focus:outline-none focus:border-indigo-500"
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
                    <option value="baremetal">Bare Metal / VM</option>
                    <option value="other">Other</option>
                  </select>
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

              {/* Ownership */}
              <div className="pt-2 border-t border-zinc-800/60">
                <h4 className="text-xs font-bold text-zinc-200 uppercase tracking-wider mb-3">
                  Service Ownership
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
                      placeholder="e.g. Alice Chen"
                      className="w-full px-3 py-2 text-sm rounded-lg bg-zinc-950 border border-zinc-800 text-white placeholder-zinc-600 focus:outline-none focus:border-indigo-500"
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
                      placeholder="alice@example.com"
                      className="w-full px-3 py-2 text-sm rounded-lg bg-zinc-950 border border-zinc-800 text-white placeholder-zinc-600 focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-zinc-400 mb-1">
                      Team / Squad
                    </label>
                    <input
                      type="text"
                      value={formOwnerTeam}
                      onChange={(e) => setFormOwnerTeam(e.target.value)}
                      placeholder="Core Payments Team"
                      className="w-full px-3 py-2 text-sm rounded-lg bg-zinc-950 border border-zinc-800 text-white placeholder-zinc-600 focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                </div>
              </div>

              {/* Links */}
              <div className="pt-2 border-t border-zinc-800/60">
                <h4 className="text-xs font-bold text-zinc-200 uppercase tracking-wider mb-3">
                  Documentation & Repositories
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-zinc-400 mb-1">
                      Git Repository URL
                    </label>
                    <input
                      type="url"
                      value={formRepoUrl}
                      onChange={(e) => setFormRepoUrl(e.target.value)}
                      placeholder="https://github.com/org/repo"
                      className="w-full px-3 py-2 text-sm rounded-lg bg-zinc-950 border border-zinc-800 text-white placeholder-zinc-600 focus:outline-none focus:border-indigo-500"
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
                      placeholder="https://docs.corp.com/runbooks/checkout"
                      className="w-full px-3 py-2 text-sm rounded-lg bg-zinc-950 border border-zinc-800 text-white placeholder-zinc-600 focus:outline-none focus:border-indigo-500"
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
                      placeholder="https://checkout.service.internal"
                      className="w-full px-3 py-2 text-sm rounded-lg bg-zinc-950 border border-zinc-800 text-white placeholder-zinc-600 focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                </div>
              </div>

              {/* Tags */}
              <div className="pt-2 border-t border-zinc-800/60">
                <label className="block text-xs font-semibold text-zinc-300 mb-1">
                  Tags (comma separated)
                </label>
                <input
                  type="text"
                  value={formTags}
                  onChange={(e) => setFormTags(e.target.value)}
                  placeholder="core, payments, tier-1, stripe"
                  className="w-full px-3 py-2 text-sm rounded-lg bg-zinc-950 border border-zinc-800 text-white placeholder-zinc-600 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-5 border-t border-zinc-800">
                <button
                  type="button"
                  onClick={() => setIsRegisterOpen(false)}
                  className="px-4 py-2 text-sm font-medium rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 text-sm font-medium rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/20 transition-all disabled:opacity-50"
                >
                  {isSubmitting ? "Registering..." : "Save Service"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
