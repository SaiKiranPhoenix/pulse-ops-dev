import {
  Activity,
  AlertCircle,
  Bookmark,
  BookmarkPlus,
  BookOpen,
  Braces,
  Check,
  Clipboard,
  Compass,
  Download,
  FileSpreadsheet,
  Filter,
  Layers,
  ListFilter,
  Loader2,
  Pause,
  Play,
  Plus,
  Radio,
  RefreshCw,
  Search,
  Send,
  Shield,
  ShieldAlert,
  SlidersHorizontal,
  Trash2,
  X,
  Zap,
} from "lucide-react";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import {
  listDashboardEventPage,
  type DashboardEvent,
  type RealtimeEventCreated,
} from "@/features/dashboards/api";
import {
  createLogPipelineRule,
  createSavedLogSearch,
  deleteLogPipelineRule,
  deleteSavedLogSearch,
  getLogContext,
  getLogRetention,
  getLogVolumeAnalytics,
  listLogPipelineRules,
  listSavedLogSearches,
  updateLogRetention,
} from "@/features/log-pipeline/api";
import type {
  LogContextResponse,
  LogPipelineProcessor,
  LogPipelineRule,
  LogProcessorType,
  LogRetentionSettings,
  LogVolumeAnalytics,
  SavedLogSearch,
} from "@/features/log-pipeline/api";
import { getApiErrorMessage } from "@/lib/api-client";
import { createPulseOpsSocket, joinProjectRoom, leaveProjectRoom } from "@/lib/socket-client";
import { cn } from "@/lib/utils";
import { formatRelativeTime } from "./dashboard-utils";
import { dashboardEnvironments, useDashboardContext } from "./DashboardLayout";

const eventTypes = ["all", "log", "error", "metric"] as const;
const levels = ["all", "debug", "info", "warn", "error"] as const;
const eventPageSize = 50;
const timeRanges = [
  { label: "15m", value: "15m", minutes: 15 },
  { label: "1h", value: "1h", minutes: 60 },
  { label: "6h", value: "6h", minutes: 360 },
  { label: "24h", value: "24h", minutes: 1440 },
  { label: "All", value: "all", minutes: null },
] as const;

type EventTypeFilter = (typeof eventTypes)[number];
type LevelFilter = (typeof levels)[number];
type TimeRangeFilter = (typeof timeRanges)[number]["value"];

export function LogsPage() {
  const { selectedEnvironment, selectedProject } = useDashboardContext();
  const { notify } = useToast();

  const [events, setEvents] = useState<DashboardEvent[]>([]);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState<EventTypeFilter>("all");
  const [levelFilter, setLevelFilter] = useState<LevelFilter>("all");
  const [serviceFilter, setServiceFilter] = useState("all");
  const [environmentFilter, setEnvironmentFilter] = useState("all");
  const [timeRange, setTimeRange] = useState<TimeRangeFilter>("24h");
  const [search, setSearch] = useState("");
  const [isLive, setIsLive] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [lastLoadedAt, setLastLoadedAt] = useState<string | null>(null);
  const [connectionState, setConnectionState] = useState("offline");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  // Pipeline & Retention state
  const [pipelineRules, setPipelineRules] = useState<LogPipelineRule[]>([]);
  const [retention, setRetention] = useState<LogRetentionSettings | null>(null);
  const [volumeAnalytics, setVolumeAnalytics] = useState<LogVolumeAnalytics | null>(null);
  const [savedSearches, setSavedSearches] = useState<SavedLogSearch[]>([]);
  const [isPipelineDrawerOpen, setIsPipelineDrawerOpen] = useState(false);
  const [isSaveSearchModalOpen, setIsSaveSearchModalOpen] = useState(false);
  const [newSearchName, setNewSearchName] = useState("");

  // Context view state
  const [contextData, setContextData] = useState<LogContextResponse | null>(null);
  const [isContextModalOpen, setIsContextModalOpen] = useState(false);
  const [isLoadingContext, setIsLoadingContext] = useState(false);

  // New pipeline rule form
  const [isAddingRule, setIsAddingRule] = useState(false);
  const [ruleName, setRuleName] = useState("");
  const [processorType, setProcessorType] = useState<LogProcessorType>("redact_regex");
  const [processorPattern, setProcessorPattern] = useState("");

  async function loadEvents(options: { readonly silent?: boolean } = {}): Promise<void> {
    if (selectedProject === null) {
      setEvents([]);
      setSelectedEventId(null);
      return;
    }

    if (!options.silent) {
      setIsLoading(true);
    }
    setError(null);

    try {
      const page = await listDashboardEventPage(selectedProject.id, { limit: eventPageSize });
      setEvents(page.events);
      setNextCursor(page.nextCursor);
      setLastLoadedAt(new Date().toISOString());
    } catch (requestError) {
      setError(getApiErrorMessage(requestError));
    } finally {
      setIsLoading(false);
    }
  }

  async function loadPipelineData(): Promise<void> {
    if (!selectedProject) return;
    try {
      const [rules, ret, analytics, searches] = await Promise.all([
        listLogPipelineRules(selectedProject.id),
        getLogRetention(selectedProject.id),
        getLogVolumeAnalytics(selectedProject.id),
        listSavedLogSearches(selectedProject.id),
      ]);
      setPipelineRules(rules);
      setRetention(ret);
      setVolumeAnalytics(analytics);
      setSavedSearches(searches);
    } catch {
      // Graceful fallback
    }
  }

  useEffect(() => {
    void loadEvents();
    void loadPipelineData();
  }, [selectedProject?.id]);

  useEffect(() => {
    if (!isLive || selectedProject === null) {
      setConnectionState("paused");
      return;
    }

    const projectId = selectedProject.id;
    const socket = createPulseOpsSocket();

    if (socket === null) {
      setConnectionState("unavailable");
      return;
    }

    socket.on("connect", () => {
      setConnectionState("connected");
      void joinProjectRoom(socket, projectId, selectedEnvironment);
      void loadEvents({ silent: true });
    });
    socket.on("disconnect", () => {
      setConnectionState("offline");
    });
    socket.on("connect_error", () => {
      setConnectionState("error");
    });
    socket.on("event.created", (update: RealtimeEventCreated) => {
      if (update.projectId !== projectId) {
        return;
      }

      setEvents((current) => upsertEvent(current, update.event));
      setLastLoadedAt(update.occurredAt);
    });
    socket.connect();

    return () => {
      leaveProjectRoom(socket, projectId, selectedEnvironment);
      socket.disconnect();
    };
  }, [isLive, selectedEnvironment, selectedProject?.id]);

  async function loadMoreEvents(): Promise<void> {
    if (selectedProject === null || nextCursor === null) {
      return;
    }

    setIsLoadingMore(true);
    setError(null);

    try {
      const page = await listDashboardEventPage(selectedProject.id, {
        cursor: nextCursor,
        limit: eventPageSize,
      });
      setEvents((current) => mergeEvents(current, page.events));
      setNextCursor(page.nextCursor);
    } catch (requestError) {
      setError(getApiErrorMessage(requestError));
    } finally {
      setIsLoadingMore(false);
    }
  }

  const services = useMemo(
    () =>
      [...new Set(events.map((event) => event.source))].sort((left, right) =>
        left.localeCompare(right),
      ),
    [events],
  );

  const filteredEvents = useMemo(
    () =>
      events.filter((event) => {
        const eventEnvironment = readAttribute(event.attributes, "environment") ?? "unknown";
        const searchable = [
          event.id,
          event.type,
          event.source,
          event.level,
          event.message,
          event.name,
          event.fingerprint,
          eventEnvironment,
          readAttribute(event.attributes, "traceId"),
          readAttribute(event.attributes, "requestId"),
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

        return (
          (typeFilter === "all" || event.type === typeFilter) &&
          (levelFilter === "all" || event.level === levelFilter) &&
          (serviceFilter === "all" || event.source === serviceFilter) &&
          (environmentFilter === "all" || eventEnvironment === environmentFilter) &&
          isInsideTimeRange(event.receivedAt, timeRange) &&
          (search.trim().length === 0 || searchable.includes(search.trim().toLowerCase()))
        );
      }),
    [environmentFilter, events, levelFilter, search, serviceFilter, timeRange, typeFilter],
  );

  useEffect(() => {
    setSelectedEventId((current) =>
      current !== null && filteredEvents.some((event) => event.id === current)
        ? current
        : (filteredEvents[0]?.id ?? null),
    );
  }, [filteredEvents]);

  const selectedEvent = useMemo(
    () => filteredEvents.find((event) => event.id === selectedEventId) ?? null,
    [filteredEvents, selectedEventId],
  );

  const summary = useMemo(
    () => ({
      errors: filteredEvents.filter((event) => event.type === "error" || event.level === "error")
        .length,
      events: filteredEvents.length,
      metrics: filteredEvents.filter((event) => event.type === "metric").length,
      services: new Set(filteredEvents.map((event) => event.source)).size,
    }),
    [filteredEvents],
  );

  async function copy(value: string, successMessage = "Copied to clipboard."): Promise<void> {
    await navigator.clipboard.writeText(value);
    setMessage(successMessage);
    setTimeout(() => setMessage(null), 2500);
  }

  function resetFilters(): void {
    setTypeFilter("all");
    setLevelFilter("all");
    setServiceFilter("all");
    setEnvironmentFilter("all");
    setTimeRange("24h");
    setSearch("");
  }

  const handleOpenContext = async (eventId: string) => {
    if (!selectedProject) return;
    setIsLoadingContext(true);
    setIsContextModalOpen(true);
    try {
      const data = await getLogContext(selectedProject.id, eventId);
      setContextData(data);
    } catch (err) {
      notify({
        title: "Failed to load log context",
        description: getApiErrorMessage(err),
        variant: "error",
      });
    } finally {
      setIsLoadingContext(false);
    }
  };

  const handleSaveSearch = async (e: FormEvent) => {
    e.preventDefault();
    if (!selectedProject || !newSearchName.trim()) return;

    try {
      const created = await createSavedLogSearch(selectedProject.id, {
        name: newSearchName.trim(),
        query: search.trim() || "*",
        serviceFilter: serviceFilter !== "all" ? serviceFilter : undefined,
        levelFilter: levelFilter !== "all" ? levelFilter : undefined,
        environment: environmentFilter !== "all" ? environmentFilter : undefined,
        timeframe: timeRange,
      });
      setSavedSearches((prev) => [created, ...prev]);
      setIsSaveSearchModalOpen(false);
      setNewSearchName("");
      notify({ title: "Search Saved", description: `Saved "${created.name}" for quick access.`, variant: "success" });
    } catch (err) {
      notify({
        title: "Save failed",
        description: getApiErrorMessage(err),
        variant: "error",
      });
    }
  };

  const handleApplySavedSearch = (saved: SavedLogSearch) => {
    setSearch(saved.query === "*" ? "" : saved.query);
    if (saved.serviceFilter) setServiceFilter(saved.serviceFilter);
    if (saved.levelFilter) setLevelFilter(saved.levelFilter as LevelFilter);
    if (saved.environment) setEnvironmentFilter(saved.environment);
    if (saved.timeframe) setTimeRange(saved.timeframe as TimeRangeFilter);
    notify({ title: "Filter Applied", description: `Applied "${saved.name}".`, variant: "info" });
  };

  const handleDeleteSavedSearch = async (searchId: string) => {
    if (!selectedProject) return;
    try {
      await deleteSavedLogSearch(selectedProject.id, searchId);
      setSavedSearches((prev) => prev.filter((s) => s.id !== searchId));
      notify({ title: "Search Removed", variant: "info" });
    } catch (err) {
      notify({ title: "Delete failed", description: getApiErrorMessage(err), variant: "error" });
    }
  };

  const handleAddPipelineRule = async (e: FormEvent) => {
    e.preventDefault();
    if (!selectedProject || !ruleName.trim()) return;

    const processor: LogPipelineProcessor = {
      id: `proc_${Date.now()}`,
      type: processorType,
      name: `${processorType} processor`,
      enabled: true,
      config: {
        redactionPatterns: processorPattern ? [processorPattern] : undefined,
        dropFilter: processorType === "drop_filter" ? processorPattern : undefined,
        sampleRatePercent: processorType === "sample_rate" ? Number(processorPattern) || 10 : undefined,
      },
    };

    try {
      const created = await createLogPipelineRule(selectedProject.id, {
        name: ruleName.trim(),
        enabled: true,
        order: pipelineRules.length + 1,
        processors: [processor],
      });
      setPipelineRules((prev) => [...prev, created]);
      setIsAddingRule(false);
      setRuleName("");
      setProcessorPattern("");
      notify({ title: "Rule Created", description: `Active in ingestion pipeline.`, variant: "success" });
    } catch (err) {
      notify({ title: "Failed to create rule", description: getApiErrorMessage(err), variant: "error" });
    }
  };

  const handleDeleteRule = async (ruleId: string) => {
    if (!selectedProject) return;
    try {
      await deleteLogPipelineRule(selectedProject.id, ruleId);
      setPipelineRules((prev) => prev.filter((r) => r.id !== ruleId));
      notify({ title: "Rule Deleted", variant: "info" });
    } catch (err) {
      notify({ title: "Delete failed", description: getApiErrorMessage(err), variant: "error" });
    }
  };

  const handleUpdateRetentionDays = async (days: number) => {
    if (!selectedProject) return;
    try {
      const updated = await updateLogRetention(selectedProject.id, {
        retentionDays: days,
        coldArchiveEnabled: retention?.coldArchiveEnabled ?? false,
      });
      setRetention(updated);
      notify({ title: "Retention Updated", description: `Retaining logs for ${days} days.`, variant: "success" });
    } catch (err) {
      notify({ title: "Update failed", description: getApiErrorMessage(err), variant: "error" });
    }
  };

  const handleExportLogs = (format: "csv" | "ndjson") => {
    if (!selectedProject) return;
    const url = `${window.location.origin}/logs/export?projectId=${encodeURIComponent(selectedProject.id)}&format=${format}`;
    window.open(url, "_blank");
    notify({ title: "Export Started", description: `Downloading log stream as ${format.toUpperCase()}`, variant: "success" });
  };

  return (
    <main className="mx-auto flex max-w-7xl flex-col gap-5">
      <header className="flex flex-col gap-3 border-b border-zinc-800 pb-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-emerald-400">
              {selectedProject?.name ?? "No project selected"} / {selectedEnvironment}
            </span>
            {isLive && (
              <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Live Stream
              </span>
            )}
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white mt-1">Log Event Explorer & Pipeline</h1>
          <p className="mt-1 max-w-3xl text-xs text-zinc-400">
            Real-time multi-source log inspection with automated sensitive-data masking, context windows, and pipeline transforms.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            onClick={() => setIsPipelineDrawerOpen(true)}
            variant="outline"
            className="border-zinc-700 text-xs text-zinc-300 hover:text-white gap-1.5"
          >
            <Shield className="h-3.5 w-3.5 text-cyan-400" />
            Pipelines & Redaction
          </Button>

          <Button
            onClick={() => setIsLive((current) => !current)}
            variant={isLive ? "primary" : "outline"}
            className="text-xs gap-1.5"
          >
            {isLive ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
            {isLive ? "Pause Stream" : "Live Tail"}
          </Button>

          <Button
            onClick={() => void loadEvents()}
            variant="outline"
            className="text-xs gap-1.5"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Refresh
          </Button>

          <div className="flex items-center gap-1 bg-zinc-900 border border-zinc-800 p-1 rounded-lg">
            <button
              onClick={() => handleExportLogs("csv")}
              className="px-2 py-1 rounded text-zinc-400 hover:text-white text-xs flex items-center gap-1 hover:bg-zinc-800"
              title="Export CSV"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
              CSV
            </button>
            <button
              onClick={() => handleExportLogs("ndjson")}
              className="px-2 py-1 rounded text-zinc-400 hover:text-white text-xs flex items-center gap-1 hover:bg-zinc-800"
              title="Export NDJSON"
            >
              <Download className="w-3.5 h-3.5 text-cyan-400" />
              NDJSON
            </button>
          </div>
        </div>
      </header>

      {message !== null && (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-2.5 text-xs text-emerald-400">
          {message}
        </div>
      )}

      {error !== null && (
        <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-2.5 text-xs text-rose-400">
          {error}
        </div>
      )}

      {/* Volume Analytics Throughput Bar */}
      {volumeAnalytics && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-zinc-900/60 border border-zinc-800/80 p-3.5 rounded-2xl backdrop-blur-md">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
              <Zap className="w-4 h-4" />
            </div>
            <div>
              <p className="text-[10px] text-zinc-500 uppercase font-semibold">Ingestion Rate</p>
              <p className="text-sm font-bold text-white font-mono">{volumeAnalytics.totalEventsPerSec} events/s</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400">
              <Activity className="w-4 h-4" />
            </div>
            <div>
              <p className="text-[10px] text-zinc-500 uppercase font-semibold">Throughput</p>
              <p className="text-sm font-bold text-white font-mono">{(volumeAnalytics.totalBytesPerSec / 1024).toFixed(1)} KB/s</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-400">
              <ShieldAlert className="w-4 h-4" />
            </div>
            <div>
              <p className="text-[10px] text-zinc-500 uppercase font-semibold">Redactions Masked</p>
              <p className="text-sm font-bold text-white font-mono">{volumeAnalytics.redactedCount} secrets</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400">
              <SlidersHorizontal className="w-4 h-4" />
            </div>
            <div>
              <p className="text-[10px] text-zinc-500 uppercase font-semibold">Sampling Rate</p>
              <p className="text-sm font-bold text-white font-mono">{volumeAnalytics.sampledPercentage}% kept</p>
            </div>
          </div>
        </div>
      )}

      {/* Saved Searches Bar */}
      <div className="flex items-center justify-between gap-2 overflow-x-auto bg-zinc-900/40 border border-zinc-800/60 px-3 py-2 rounded-xl">
        <div className="flex items-center gap-2">
          <Bookmark className="w-3.5 h-3.5 text-zinc-500" />
          <span className="text-[11px] font-semibold text-zinc-400 uppercase">Saved:</span>
          {savedSearches.length === 0 ? (
            <span className="text-[11px] text-zinc-600">No saved searches yet</span>
          ) : (
            savedSearches.map((s) => (
              <div
                key={s.id}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-zinc-800/80 border border-zinc-700/60 text-xs text-zinc-300 group"
              >
                <button
                  onClick={() => handleApplySavedSearch(s)}
                  className="hover:text-white font-medium"
                >
                  {s.name}
                </button>
                <button
                  onClick={() => void handleDeleteSavedSearch(s.id)}
                  className="text-zinc-500 hover:text-rose-400 opacity-0 group-hover:opacity-100 transition-opacity ml-1"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))
          )}
        </div>

        <Button
          onClick={() => setIsSaveSearchModalOpen(true)}
          variant="ghost"
          className="text-xs text-emerald-400 hover:text-emerald-300 gap-1.5 h-7 px-2"
        >
          <BookmarkPlus className="w-3.5 h-3.5" />
          Save Active Search
        </Button>
      </div>

      <section className="grid gap-3 md:grid-cols-4">
        <Summary label="Visible events" value={summary.events} />
        <Summary label="Active Services" value={summary.services} />
        <Summary label="Errors Captured" value={summary.errors} />
        <Summary label="Metric Points" value={summary.metrics} />
      </section>

      {/* Filters Bar */}
      <section className="grid gap-3 rounded-2xl border border-zinc-800 bg-zinc-900/80 p-4 shadow-xl backdrop-blur-md">
        <div className="grid gap-3 xl:grid-cols-[1fr_9rem_10rem_11rem_11rem_8rem_auto_auto]">
          <label className="relative block">
            <span className="sr-only">Search events</span>
            <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-zinc-500" />
            <Input
              className="pl-9 bg-zinc-950 border-zinc-800 text-xs"
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search message, source, trace ID, request ID..."
              value={search}
            />
          </label>

          <SelectFilter
            label="Type"
            onChange={(value) => setTypeFilter(value as EventTypeFilter)}
            options={eventTypes}
            value={typeFilter}
          />
          <SelectFilter
            label="Level"
            onChange={(value) => setLevelFilter(value as LevelFilter)}
            options={levels}
            value={levelFilter}
          />
          <SelectFilter
            label="Service"
            onChange={setServiceFilter}
            options={["all", ...services]}
            value={serviceFilter}
          />
          <SelectFilter
            label="Environment"
            onChange={setEnvironmentFilter}
            options={["all", ...dashboardEnvironments]}
            value={environmentFilter}
          />
          <SelectFilter
            label="Time"
            onChange={(value) => setTimeRange(value as TimeRangeFilter)}
            options={timeRanges.map((range) => range.value)}
            value={timeRange}
          />

          <Button
            className="w-full sm:w-auto text-xs"
            onClick={resetFilters}
            type="button"
            variant="outline"
          >
            <X className="h-3.5 w-3.5" />
            Reset
          </Button>

          <Button asChild className="w-full sm:w-auto text-xs" variant="outline">
            <Link to="/dashboard/setup">
              <Send className="h-3.5 w-3.5 text-emerald-400" />
              Send Test
            </Link>
          </Button>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-500 border-t border-zinc-800/60 pt-2">
          <Radio className="h-3.5 w-3.5 text-emerald-400" />
          <span>{isLive ? `Live socket: ${connectionState}` : "Realtime paused"}</span>
          <span>•</span>
          <span>
            {lastLoadedAt === null
              ? "Not loaded yet"
              : `Updated ${formatRelativeTime(lastLoadedAt)}`}
          </span>
        </div>
      </section>

      {/* Main Grid: Events & Event Detail */}
      <section className="grid gap-4 xl:grid-cols-[1fr_26rem]">
        <div className="overflow-x-auto rounded-2xl border border-zinc-800 bg-zinc-900/60 backdrop-blur-md shadow-xl">
          <div className="grid min-w-[62rem] grid-cols-[5rem_6rem_8rem_1fr_9rem_7rem_6rem] gap-3 border-b border-zinc-800 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-zinc-500">
            <span>Type</span>
            <span>Level</span>
            <span>Service</span>
            <span>Message</span>
            <span>Trace</span>
            <span>Received</span>
            <span className="text-right">Action</span>
          </div>

          <div className="min-w-[62rem]">
            {filteredEvents.length === 0 ? (
              <EmptyLogs isLoading={isLoading} />
            ) : (
              <div className="divide-y divide-zinc-850">
                {filteredEvents.map((event) => (
                  <div
                    className={cn(
                      "grid w-full grid-cols-[5rem_6rem_8rem_1fr_9rem_7rem_6rem] items-center gap-3 px-4 py-3 text-left transition hover:bg-zinc-800/40 group",
                      selectedEventId === event.id && "bg-emerald-500/10 border-l-2 border-emerald-400",
                    )}
                    key={event.id}
                  >
                    <button
                      type="button"
                      onClick={() => setSelectedEventId(event.id)}
                      className="text-left w-fit"
                    >
                      <span
                        className={cn(
                          "rounded-md border px-2 py-0.5 text-[10px] font-bold uppercase",
                          typeClass(event),
                        )}
                      >
                        {event.type}
                      </span>
                    </button>
                    <span className="text-xs uppercase font-bold text-zinc-400">{event.level ?? "-"}</span>
                    <span className="truncate text-xs font-mono text-zinc-300">{event.source}</span>
                    <button
                      type="button"
                      onClick={() => setSelectedEventId(event.id)}
                      className="min-w-0 text-left cursor-pointer"
                    >
                      <span className="block truncate text-xs font-medium text-white">
                        {event.message ?? event.name ?? event.fingerprint}
                      </span>
                      <span className="mt-0.5 block truncate font-mono text-[10px] text-zinc-500">
                        {readAttribute(event.attributes, "environment") ?? "unknown"} • {event.fingerprint}
                      </span>
                    </button>
                    <span className="truncate font-mono text-[11px] text-zinc-400">
                      {readAttribute(event.attributes, "traceId") ?? "-"}
                    </span>
                    <span className="text-xs text-zinc-500">
                      {formatRelativeTime(event.receivedAt)}
                    </span>
                    <div className="text-right">
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={() => void handleOpenContext(event.id)}
                        className="text-[11px] text-cyan-400 hover:text-cyan-300 h-6 px-2 opacity-0 group-hover:opacity-100 transition-opacity gap-1"
                        title="View surrounding log context (+-25 lines)"
                      >
                        <Compass className="w-3 h-3" />
                        Context
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <div className="border-t border-zinc-800 p-3">
              <Button
                disabled={nextCursor === null || isLoadingMore}
                onClick={() => void loadMoreEvents()}
                type="button"
                variant="outline"
                className="text-xs text-zinc-300"
              >
                {isLoadingMore ? "Loading older events..." : "Load Older Events"}
              </Button>
            </div>
          </div>
        </div>

        <EventDetail event={selectedEvent} onCopy={copy} onOpenContext={handleOpenContext} />
      </section>

      {/* Modal: Log Context Viewer */}
      {isContextModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-4xl max-h-[85vh] rounded-2xl border border-zinc-800 bg-zinc-900 p-6 shadow-2xl flex flex-col space-y-4">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <div className="flex items-center gap-2">
                <Compass className="w-5 h-5 text-cyan-400" />
                <h3 className="text-base font-bold text-white">
                  Log Context Window (±25 Surrounding Events)
                </h3>
              </div>
              <button
                onClick={() => setIsContextModalOpen(false)}
                className="text-zinc-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {isLoadingContext ? (
              <div className="flex items-center justify-center p-16">
                <Loader2 className="w-8 h-8 animate-spin text-cyan-400" />
              </div>
            ) : contextData ? (
              <div className="flex-1 overflow-y-auto space-y-1 font-mono text-xs pr-2 divide-y divide-zinc-850">
                <div className="text-[10px] text-zinc-500 font-sans uppercase font-bold py-1">
                  ▲ Precursor Events (25 lines before)
                </div>
                {contextData.before.map((b, idx) => (
                  <div key={idx} className="py-1 px-2 hover:bg-zinc-800/40 rounded flex items-center gap-2 text-zinc-400">
                    <span className="text-zinc-600 text-[10px] w-20">{String(b.timestamp).slice(11, 19)}</span>
                    <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-zinc-800 text-zinc-300 uppercase">
                      {String(b.level)}
                    </span>
                    <span className="text-zinc-500 text-[11px] w-32 truncate">{String(b.service)}</span>
                    <span className="truncate flex-1 text-zinc-300">{String(b.message)}</span>
                  </div>
                ))}

                {/* Highlighted Target Event */}
                {contextData.target && (
                  <div className="py-2.5 px-3 bg-rose-950/40 border-y-2 border-rose-500 my-2 rounded flex flex-col gap-1 text-white shadow-lg">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-500/20 text-rose-400 uppercase">
                        TARGET INVESTIGATION EVENT
                      </span>
                      <span className="text-[11px] font-mono text-zinc-400">{String(contextData.target.id)}</span>
                    </div>
                    <p className="font-bold text-sm text-rose-200 mt-1">{String(contextData.target.message)}</p>
                    {Boolean(contextData.target.stack) && (
                      <pre className="mt-1 p-2 rounded bg-zinc-950 border border-zinc-800 text-[10px] text-rose-300 whitespace-pre-wrap">
                        {String(contextData.target.stack)}
                      </pre>
                    )}
                  </div>
                )}

                <div className="text-[10px] text-zinc-500 font-sans uppercase font-bold py-1 pt-3">
                  ▼ Post-Incident Successors (25 lines after)
                </div>
                {contextData.after.map((a, idx) => (
                  <div key={idx} className="py-1 px-2 hover:bg-zinc-800/40 rounded flex items-center gap-2 text-zinc-400">
                    <span className="text-zinc-600 text-[10px] w-20">{String(a.timestamp).slice(11, 19)}</span>
                    <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-zinc-800 text-zinc-300 uppercase">
                      {String(a.level)}
                    </span>
                    <span className="text-zinc-500 text-[11px] w-32 truncate">{String(a.service)}</span>
                    <span className="truncate flex-1 text-zinc-300">{String(a.message)}</span>
                  </div>
                ))}
              </div>
            ) : null}

            <div className="flex justify-end pt-3 border-t border-zinc-800">
              <Button onClick={() => setIsContextModalOpen(false)} variant="ghost" className="text-xs text-zinc-400">
                Close
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Save Search */}
      {isSaveSearchModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-900 p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <BookmarkPlus className="w-4 h-4 text-emerald-400" />
                Save Log Search
              </h3>
              <button onClick={() => setIsSaveSearchModalOpen(false)} className="text-zinc-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveSearch} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-zinc-300">Search Name</label>
                <Input
                  required
                  placeholder="e.g. Gateway 5xx Bursts"
                  value={newSearchName}
                  onChange={(e) => setNewSearchName(e.target.value)}
                  className="bg-zinc-950 border-zinc-800 text-xs"
                />
              </div>

              <div className="p-3 rounded-lg bg-zinc-950 border border-zinc-800 space-y-1 text-xs text-zinc-400">
                <p><span className="text-zinc-500">Query:</span> {search || "*"}</p>
                <p><span className="text-zinc-500">Service:</span> {serviceFilter}</p>
                <p><span className="text-zinc-500">Level:</span> {levelFilter}</p>
                <p><span className="text-zinc-500">Timeframe:</span> {timeRange}</p>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-zinc-800">
                <Button type="button" variant="ghost" onClick={() => setIsSaveSearchModalOpen(false)} className="text-xs text-zinc-400">
                  Cancel
                </Button>
                <Button type="submit" className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium">
                  Save Search
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Pipelines & Retention Drawer */}
      {isPipelineDrawerOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-3xl max-h-[85vh] rounded-2xl border border-zinc-800 bg-zinc-900 p-6 shadow-2xl flex flex-col space-y-5">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <div className="flex items-center gap-2">
                <Shield className="w-5 h-5 text-cyan-400" />
                <h3 className="text-base font-bold text-white">Log Pipeline Processors & Retention</h3>
              </div>
              <button onClick={() => setIsPipelineDrawerOpen(false)} className="text-zinc-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-6 pr-1">
              {/* Retention Policy Section */}
              <div className="rounded-xl bg-zinc-950 border border-zinc-800 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-zinc-200 uppercase tracking-wide flex items-center gap-2">
                    <Layers className="w-4 h-4 text-emerald-400" />
                    Project Log Retention Policy
                  </h4>
                  <span className="text-xs text-zinc-500 font-mono">Current: {retention?.retentionDays ?? 30} days</span>
                </div>
                <div className="grid grid-cols-4 gap-2 pt-1">
                  {[7, 30, 90, 365].map((d) => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => void handleUpdateRetentionDays(d)}
                      className={`p-2 rounded-lg border text-xs font-medium transition-all ${
                        retention?.retentionDays === d
                          ? "bg-emerald-500/20 border-emerald-500/50 text-emerald-300"
                          : "bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-white"
                      }`}
                    >
                      {d} Days
                    </button>
                  ))}
                </div>
              </div>

              {/* Active Pipeline Rules Section */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-zinc-200 uppercase tracking-wide flex items-center gap-2">
                    <ListFilter className="w-4 h-4 text-cyan-400" />
                    Ingestion Transformation Processors
                  </h4>
                  <Button
                    onClick={() => setIsAddingRule(true)}
                    variant="outline"
                    className="text-xs border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10 gap-1.5 h-7 px-2.5"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Add Processor
                  </Button>
                </div>

                {/* Built-in Auto Redaction Banner */}
                <div className="p-3.5 rounded-xl bg-emerald-950/20 border border-emerald-900/30 flex items-start gap-3">
                  <Shield className="w-5 h-5 text-emerald-400 mt-0.5" />
                  <div>
                    <h5 className="text-xs font-bold text-emerald-300">Automated Sensitive-Data Scanner Active</h5>
                    <p className="text-[11px] text-zinc-400 mt-0.5">
                      Automatically detects and redacts JWTs, Bearer tokens, AWS Access Keys, SSH Private Keys, Credit Cards (Luhn), and password fields across all inbound telemetry.
                    </p>
                  </div>
                </div>

                {pipelineRules.length === 0 ? (
                  <div className="p-8 text-center text-xs text-zinc-500 border border-dashed border-zinc-800 rounded-xl">
                    No custom pipeline processors configured. All logs pass through the default scanner.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {pipelineRules.map((rule) => (
                      <div
                        key={rule.id}
                        className="p-3 rounded-xl bg-zinc-950 border border-zinc-800 flex items-center justify-between gap-3"
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-white">{rule.name}</span>
                            <span className="px-1.5 py-0.2 rounded text-[10px] bg-zinc-800 text-zinc-400 font-mono">
                              #{rule.order}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 mt-1">
                            {rule.processors.map((p) => (
                              <span
                                key={p.id}
                                className="px-2 py-0.5 rounded text-[10px] font-medium bg-cyan-500/10 text-cyan-400 border border-cyan-500/20"
                              >
                                {p.type}
                              </span>
                            ))}
                          </div>
                        </div>
                        <Button
                          onClick={() => void handleDeleteRule(rule.id)}
                          variant="ghost"
                          className="text-xs text-rose-400 hover:text-rose-300 h-8 px-2"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Add Rule Form */}
              {isAddingRule && (
                <form onSubmit={handleAddPipelineRule} className="p-4 rounded-xl bg-zinc-950 border border-zinc-800 space-y-3">
                  <h5 className="text-xs font-bold text-white">Create Pipeline Processor</h5>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-[11px] font-semibold text-zinc-400">Rule Name</label>
                      <Input
                        required
                        placeholder="e.g. Drop Healthchecks"
                        value={ruleName}
                        onChange={(e) => setRuleName(e.target.value)}
                        className="bg-zinc-900 border-zinc-800 text-xs"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[11px] font-semibold text-zinc-400">Processor Type</label>
                      <select
                        value={processorType}
                        onChange={(e) => setProcessorType(e.target.value as LogProcessorType)}
                        className="h-10 w-full rounded-md border border-zinc-800 bg-zinc-900 px-3 text-xs text-white"
                      >
                        <option value="redact_regex">Regex Redaction</option>
                        <option value="drop_filter">Drop Filter</option>
                        <option value="sample_rate">Probabilistic Sampling</option>
                        <option value="parse_json">JSON Parser</option>
                        <option value="remap_fields">Field Remapper</option>
                      </select>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] font-semibold text-zinc-400">
                      {processorType === "sample_rate" ? "Sample Percentage (0-100)" : "Pattern / Filter String"}
                    </label>
                    <Input
                      placeholder={
                        processorType === "sample_rate"
                          ? "10"
                          : processorType === "drop_filter"
                            ? "GET /healthz"
                            : "api_key=[a-zA-Z0-9]+"
                      }
                      value={processorPattern}
                      onChange={(e) => setProcessorPattern(e.target.value)}
                      className="bg-zinc-900 border-zinc-800 text-xs"
                    />
                  </div>

                  <div className="flex justify-end gap-2 pt-2">
                    <Button type="button" variant="ghost" onClick={() => setIsAddingRule(false)} className="text-xs text-zinc-400">
                      Cancel
                    </Button>
                    <Button type="submit" className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium">
                      Save Processor
                    </Button>
                  </div>
                </form>
              )}
            </div>

            <div className="flex justify-end pt-3 border-t border-zinc-800">
              <Button onClick={() => setIsPipelineDrawerOpen(false)} variant="ghost" className="text-xs text-zinc-400">
                Close
              </Button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

function EventDetail({
  event,
  onCopy,
  onOpenContext,
}: {
  readonly event: DashboardEvent | null;
  readonly onCopy: (value: string, successMessage?: string) => Promise<void>;
  readonly onOpenContext: (eventId: string) => Promise<void>;
}) {
  const redactedJson = useMemo(
    () => (event === null ? "" : JSON.stringify(redactSensitiveValues(event), null, 2)),
    [event],
  );

  return (
    <aside className="rounded-2xl border border-zinc-800 bg-zinc-900/60 backdrop-blur-md p-4 shadow-xl flex flex-col justify-between">
      <div>
        <div className="flex items-center justify-between gap-3 border-b border-zinc-800 pb-3">
          <div className="flex items-center gap-2">
            <Braces className="h-4 w-4 text-emerald-400" />
            <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-300">
              Event Inspector
            </h2>
          </div>
          {event !== null ? (
            <div className="flex items-center gap-1.5">
              <Button
                className="text-xs h-7 px-2 text-cyan-400 border-cyan-500/30 hover:bg-cyan-500/10 gap-1"
                onClick={() => void onOpenContext(event.id)}
                variant="outline"
              >
                <Compass className="h-3.5 w-3.5" />
                Context
              </Button>
              <Button
                className="h-7 w-7 px-0"
                onClick={() => void onCopy(redactedJson, "Redacted event JSON copied.")}
                title="Copy redacted JSON"
                type="button"
                variant="outline"
              >
                <Clipboard className="h-3.5 w-3.5" />
              </Button>
            </div>
          ) : null}
        </div>

        {event === null ? (
          <p className="mt-6 text-xs text-zinc-500">Select an event from the feed to inspect attributes and surrounding context.</p>
        ) : (
          <div className="mt-4 grid gap-4">
            <dl className="grid gap-2.5 text-xs">
              <Detail copyValue={event.id} label="Event ID" onCopy={onCopy} value={event.id} mono />
              <Detail label="Type" value={event.type} />
              <Detail label="Source Service" value={event.source} />
              <Detail label="Severity Level" value={event.level ?? "-"} />
              <Detail label="Message" value={event.message ?? event.name ?? "-"} />
              <Detail
                copyValue={event.fingerprint}
                label="Fingerprint"
                onCopy={onCopy}
                value={event.fingerprint}
                mono
              />
              <Detail
                copyValue={readAttribute(event.attributes, "traceId") ?? undefined}
                label="Trace ID"
                onCopy={onCopy}
                value={readAttribute(event.attributes, "traceId") ?? "-"}
                mono
              />
              <Detail label="Observed" value={new Date(event.observedAt).toLocaleString()} />
              <Detail label="Received" value={new Date(event.receivedAt).toLocaleString()} />
            </dl>

            <section>
              <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                Redacted Payload Preview
              </p>
              <pre className="mt-2 max-h-[18rem] overflow-auto whitespace-pre-wrap break-words rounded-xl bg-zinc-950 p-3 text-[11px] leading-5 text-zinc-300 font-mono border border-zinc-800">
                {redactedJson}
              </pre>
            </section>
          </div>
        )}
      </div>
    </aside>
  );
}

function EmptyLogs({ isLoading }: { readonly isLoading: boolean }) {
  return (
    <div className="flex min-w-[62rem] items-start gap-3 px-4 py-12 text-xs text-zinc-500">
      <AlertCircle className="mt-0.5 h-4 w-4 text-zinc-400" />
      <div>
        <p className="font-semibold text-zinc-300">
          {isLoading ? "Streaming events..." : "No logs match the current filters"}
        </p>
        <p className="mt-1 text-zinc-500">
          Generate an API key, send test telemetry, or adjust filters to broaden the log exploration window.
        </p>
      </div>
    </div>
  );
}

function Summary({ label, value }: { readonly label: string; readonly value: number }) {
  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 backdrop-blur-md p-4 shadow-xl">
      <p className="text-xs font-semibold text-zinc-400">{label}</p>
      <p className="mt-2 text-2xl font-bold text-white tabular-nums tracking-tight">{value}</p>
    </div>
  );
}

function SelectFilter({
  label,
  onChange,
  options,
  value,
}: {
  readonly label: string;
  readonly onChange: (value: string) => void;
  readonly options: readonly string[];
  readonly value: string;
}) {
  return (
    <label className="block">
      <span className="sr-only">{label}</span>
      <select
        className="h-10 w-full rounded-md border border-zinc-800 bg-zinc-950 px-3 text-xs capitalize text-zinc-200 shadow-sm outline-none focus:ring-1 focus:ring-emerald-500"
        onChange={(event) => onChange(event.target.value)}
        value={value}
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {formatFilterLabel(option)}
          </option>
        ))}
      </select>
    </label>
  );
}

function Detail({
  copyValue,
  label,
  mono = false,
  onCopy,
  value,
}: {
  readonly copyValue?: string;
  readonly label: string;
  readonly mono?: boolean;
  readonly onCopy?: (value: string, successMessage?: string) => Promise<void>;
  readonly value: string;
}) {
  return (
    <div>
      <dt className="flex items-center justify-between gap-3 text-[10px] font-bold uppercase tracking-wider text-zinc-500">
        {label}
        {copyValue !== undefined && onCopy !== undefined ? (
          <button
            className="text-zinc-500 transition hover:text-white"
            onClick={() => void onCopy(copyValue)}
            type="button"
          >
            <Clipboard className="h-3 w-3" />
          </button>
        ) : null}
      </dt>
      <dd className={cn("mt-0.5 break-words text-zinc-200", mono && "font-mono text-[11px]")}>
        {value}
      </dd>
    </div>
  );
}

function typeClass(event: DashboardEvent): string {
  if (event.type === "error" || event.level === "error") {
    return "border-rose-500/30 bg-rose-500/15 text-rose-300";
  }

  if (event.level === "warn") {
    return "border-amber-500/30 bg-amber-500/15 text-amber-300";
  }

  if (event.type === "metric") {
    return "border-cyan-500/30 bg-cyan-500/15 text-cyan-300";
  }

  return "border-emerald-500/30 bg-emerald-500/15 text-emerald-300";
}

function isInsideTimeRange(value: string, range: TimeRangeFilter): boolean {
  const selectedRange = timeRanges.find((candidate) => candidate.value === range);

  if (selectedRange?.minutes === null) {
    return true;
  }

  const minutes = selectedRange?.minutes ?? 1440;
  return Date.now() - Date.parse(value) <= minutes * 60 * 1_000;
}

function readAttribute(attributes: Record<string, unknown>, key: string): string | null {
  const value = attributes[key];
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}

function redactSensitiveValues(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(redactSensitiveValues);
  }

  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, nestedValue]) => [
        key,
        isSensitiveKey(key) ? "[redacted]" : redactSensitiveValues(nestedValue),
      ]),
    );
  }

  return value;
}

function isSensitiveKey(key: string): boolean {
  return /password|secret|token|api.?key|authorization|cookie|credential/i.test(key);
}

function formatFilterLabel(value: string): string {
  return value === "all" ? "All" : value;
}

function upsertEvent(events: DashboardEvent[], incoming: DashboardEvent): DashboardEvent[] {
  return mergeEvents([incoming], events);
}

function mergeEvents(current: DashboardEvent[], incoming: DashboardEvent[]): DashboardEvent[] {
  const eventsById = new Map<string, DashboardEvent>();

  for (const event of [...current, ...incoming]) {
    eventsById.set(event.id, event);
  }

  return [...eventsById.values()].sort(
    (left, right) => Date.parse(right.receivedAt) - Date.parse(left.receivedAt),
  );
}
