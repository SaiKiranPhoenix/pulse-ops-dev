import {
  Activity,
  AlertCircle,
  Box,
  CheckCircle2,
  Cpu,
  Database,
  ExternalLink,
  HardDrive,
  Layers,
  Network,
  RefreshCw,
  Search,
  Server,
  ShieldCheck,
  Terminal,
  Zap,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import {
  getDependencyHealth,
  getInfrastructureOverview,
  listContainers,
  listHostNodes,
  type ContainerNode,
  type DependencyHealth,
  type HostNode,
  type InfrastructureOverview,
} from "@/features/infrastructure/api";
import { getApiErrorMessage } from "@/lib/api-client";
import { createPulseOpsSocket, joinProjectRoom, leaveProjectRoom } from "@/lib/socket-client";
import { cn } from "@/lib/utils";
import { useDashboardContext } from "./DashboardLayout";

export function InfrastructurePage() {
  const { selectedEnvironment, selectedProject } = useDashboardContext();
  const { notify } = useToast();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState<"containers" | "hosts" | "dependencies">("containers");
  const [overview, setOverview] = useState<InfrastructureOverview | null>(null);
  const [hosts, setHosts] = useState<HostNode[]>([]);
  const [containers, setContainers] = useState<ContainerNode[]>([]);
  const [dependencies, setDependencies] = useState<DependencyHealth[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  async function loadData(): Promise<void> {
    if (!selectedProject) return;
    setIsLoading(true);
    try {
      const [ov, h, c, d] = await Promise.all([
        getInfrastructureOverview(selectedProject.id),
        listHostNodes(selectedProject.id),
        listContainers(selectedProject.id),
        getDependencyHealth(selectedProject.id),
      ]);
      setOverview(ov);
      setHosts(h);
      setContainers(c);
      setDependencies(d);
    } catch (err) {
      notify({
        title: "Failed to load infrastructure",
        description: getApiErrorMessage(err),
        variant: "error",
      });
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
  }, [selectedProject?.id, selectedEnvironment]);

  // Live WebSocket updates
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

  const filteredContainers = useMemo(() => {
    if (!searchTerm.trim()) return containers;
    const q = searchTerm.toLowerCase();
    return containers.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.serviceName.toLowerCase().includes(q) ||
        c.containerId.toLowerCase().includes(q) ||
        c.image.toLowerCase().includes(q),
    );
  }, [containers, searchTerm]);

  const filteredHosts = useMemo(() => {
    if (!searchTerm.trim()) return hosts;
    const q = searchTerm.toLowerCase();
    return hosts.filter(
      (h) =>
        h.hostname.toLowerCase().includes(q) ||
        h.ipAddress.toLowerCase().includes(q) ||
        h.os.toLowerCase().includes(q),
    );
  }, [hosts, searchTerm]);

  const formatUptime = (seconds: number) => {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    if (days > 0) return `${days}d ${hours}h`;
    const mins = Math.floor((seconds % 3600) / 60);
    return `${hours}h ${mins}m`;
  };

  return (
    <main className="mx-auto flex max-w-7xl flex-col gap-6">
      {/* Header */}
      <header className="flex flex-col gap-3 border-b border-zinc-800 pb-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-emerald-400">
              {selectedProject?.name ?? "No project selected"} / {selectedEnvironment}
            </span>
            <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
              Docker & Node Telemetry Active
            </span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white mt-1">
            Infrastructure & Container Fleet
          </h1>
          <p className="mt-1 max-w-3xl text-xs text-zinc-400">
            Real-time host node vitals, Docker container metrics, and core dependency health
            monitoring (RabbitMQ, Redis, MongoDB, Vault).
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button onClick={() => void loadData()} variant="outline" className="text-xs gap-1.5 h-9">
            <RefreshCw className={cn("h-3.5 w-3.5", isLoading && "animate-spin")} />
            Refresh Fleet
          </Button>
        </div>
      </header>

      {/* Cluster Overview Stats */}
      {overview && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4 backdrop-blur-md">
            <div className="flex items-center justify-between text-zinc-400">
              <span className="text-xs font-semibold uppercase tracking-wider">Host Nodes</span>
              <Server className="w-4 h-4 text-emerald-400" />
            </div>
            <p className="text-2xl font-bold text-white font-mono mt-2">
              {overview.healthyHosts} / {overview.totalHosts}
            </p>
            <p className="text-[11px] text-zinc-500 mt-1">Nodes healthy & connected</p>
          </div>

          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4 backdrop-blur-md">
            <div className="flex items-center justify-between text-zinc-400">
              <span className="text-xs font-semibold uppercase tracking-wider">Containers</span>
              <Box className="w-4 h-4 text-cyan-400" />
            </div>
            <p className="text-2xl font-bold text-white font-mono mt-2">
              {overview.runningContainers} / {overview.totalContainers}
            </p>
            <p className="text-[11px] text-zinc-500 mt-1">Docker containers running</p>
          </div>

          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4 backdrop-blur-md">
            <div className="flex items-center justify-between text-zinc-400">
              <span className="text-xs font-semibold uppercase tracking-wider">Avg CPU Fleet</span>
              <Cpu className="w-4 h-4 text-purple-400" />
            </div>
            <p className="text-2xl font-bold text-white font-mono mt-2">
              {overview.avgCpuPercent}%
            </p>
            <div className="w-full h-1.5 rounded-full bg-zinc-800 mt-2 overflow-hidden">
              <div
                className="h-full rounded-full bg-purple-500"
                style={{ width: `${overview.avgCpuPercent}%` }}
              />
            </div>
          </div>

          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4 backdrop-blur-md">
            <div className="flex items-center justify-between text-zinc-400">
              <span className="text-xs font-semibold uppercase tracking-wider">
                Avg Memory Fleet
              </span>
              <HardDrive className="w-4 h-4 text-amber-400" />
            </div>
            <p className="text-2xl font-bold text-white font-mono mt-2">
              {overview.avgMemoryPercent}%
            </p>
            <div className="w-full h-1.5 rounded-full bg-zinc-800 mt-2 overflow-hidden">
              <div
                className="h-full rounded-full bg-amber-500"
                style={{ width: `${overview.avgMemoryPercent}%` }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Tabs & Search Filter */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-zinc-800 pb-3">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab("containers")}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all",
              activeTab === "containers"
                ? "bg-zinc-800 text-white border border-zinc-700 shadow-md"
                : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/60",
            )}
          >
            <Box className="w-4 h-4 text-cyan-400" />
            Docker Containers ({containers.length})
          </button>

          <button
            onClick={() => setActiveTab("hosts")}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all",
              activeTab === "hosts"
                ? "bg-zinc-800 text-white border border-zinc-700 shadow-md"
                : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/60",
            )}
          >
            <Server className="w-4 h-4 text-emerald-400" />
            Host Nodes ({hosts.length})
          </button>

          <button
            onClick={() => setActiveTab("dependencies")}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all",
              activeTab === "dependencies"
                ? "bg-zinc-800 text-white border border-zinc-700 shadow-md"
                : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/60",
            )}
          >
            <Database className="w-4 h-4 text-amber-400" />
            Core Dependencies ({dependencies.length})
          </button>
        </div>

        <div className="relative w-full sm:w-64">
          <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-zinc-500" />
          <Input
            placeholder="Filter resources..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9 h-8 bg-zinc-950 border-zinc-800 text-xs"
          />
        </div>
      </div>

      {/* Tab 1: Docker Containers */}
      {activeTab === "containers" && (
        <div className="overflow-x-auto rounded-2xl border border-zinc-800 bg-zinc-900/60 backdrop-blur-md shadow-2xl">
          <table className="w-full text-left text-xs text-zinc-300">
            <thead className="border-b border-zinc-800 bg-zinc-950/60 text-[11px] font-bold uppercase tracking-wider text-zinc-500">
              <tr>
                <th className="px-5 py-3.5">Container Name & ID</th>
                <th className="px-4 py-3.5">Mapped Service</th>
                <th className="px-4 py-3.5">Host Node</th>
                <th className="px-4 py-3.5">Status</th>
                <th className="px-4 py-3.5">CPU Load</th>
                <th className="px-4 py-3.5">Memory Usage</th>
                <th className="px-4 py-3.5">Uptime</th>
                <th className="px-4 py-3.5 text-right">Logs Correlation</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-850">
              {filteredContainers.map((c) => (
                <tr key={c.id} className="hover:bg-zinc-800/30 transition-colors">
                  <td className="px-5 py-3.5">
                    <div className="font-bold text-white flex items-center gap-1.5">
                      <Box className="w-3.5 h-3.5 text-cyan-400" />
                      {c.name}
                    </div>
                    <div className="text-[11px] text-zinc-500 font-mono mt-0.5">
                      {c.containerId} • {c.image}
                    </div>
                  </td>

                  <td className="px-4 py-3.5">
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-zinc-800 text-zinc-300 font-mono">
                      {c.serviceName}
                    </span>
                  </td>

                  <td className="px-4 py-3.5 font-mono text-zinc-400 text-[11px]">{c.hostId}</td>

                  <td className="px-4 py-3.5">
                    <span
                      className={cn(
                        "px-2 py-0.5 rounded-full text-[10px] font-bold uppercase border",
                        c.status === "running"
                          ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                          : "bg-amber-500/10 border-amber-500/30 text-amber-400",
                      )}
                    >
                      {c.status}
                    </span>
                  </td>

                  <td className="px-4 py-3.5 font-mono">
                    <div className="flex items-center gap-2">
                      <div className="w-16 h-1.5 rounded-full bg-zinc-800 overflow-hidden">
                        <div
                          className={cn(
                            "h-full rounded-full",
                            c.cpuPercent > 70 ? "bg-rose-500" : "bg-cyan-400",
                          )}
                          style={{ width: `${c.cpuPercent}%` }}
                        />
                      </div>
                      <span>{c.cpuPercent.toFixed(1)}%</span>
                    </div>
                  </td>

                  <td className="px-4 py-3.5 font-mono text-zinc-300">
                    {c.memoryUsageMb} / {c.memoryLimitMb} MB
                  </td>

                  <td className="px-4 py-3.5 font-mono text-zinc-400 text-[11px]">
                    {formatUptime(c.uptimeSeconds)}
                  </td>

                  <td className="px-4 py-3.5 text-right">
                    <Button
                      onClick={() => navigate(`/dashboard/logs?query=service:${c.serviceName}`)}
                      variant="ghost"
                      className="text-xs h-7 px-2.5 text-cyan-400 hover:text-cyan-300 hover:bg-cyan-500/10 gap-1"
                    >
                      <Terminal className="w-3 h-3" />
                      Logs
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Tab 2: Host Nodes */}
      {activeTab === "hosts" && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredHosts.map((h) => (
            <div
              key={h.id}
              className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5 backdrop-blur-md shadow-2xl space-y-4"
            >
              <div className="flex items-start justify-between">
                <div>
                  <h4 className="text-sm font-bold text-white flex items-center gap-2">
                    <Server className="w-4 h-4 text-emerald-400" />
                    {h.hostname}
                  </h4>
                  <p className="text-[11px] text-zinc-500 font-mono mt-0.5">
                    {h.ipAddress} • {h.cpuCores} cores • {Math.round(h.memoryTotalMb / 1024)} GB RAM
                  </p>
                </div>

                <span
                  className={cn(
                    "px-2 py-0.5 rounded-full text-[10px] font-bold uppercase border",
                    h.status === "healthy"
                      ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                      : "bg-amber-500/10 border-amber-500/30 text-amber-400",
                  )}
                >
                  {h.status}
                </span>
              </div>

              {/* Resource Gauges */}
              <div className="space-y-2 pt-2 border-t border-zinc-800/80">
                <div>
                  <div className="flex justify-between text-[11px] font-mono text-zinc-400 mb-1">
                    <span>CPU Usage</span>
                    <span>{h.cpuPercent.toFixed(1)}%</span>
                  </div>
                  <div className="w-full h-1.5 rounded-full bg-zinc-800 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-purple-500"
                      style={{ width: `${h.cpuPercent}%` }}
                    />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-[11px] font-mono text-zinc-400 mb-1">
                    <span>Memory Usage</span>
                    <span>{h.memoryPercent.toFixed(1)}%</span>
                  </div>
                  <div className="w-full h-1.5 rounded-full bg-zinc-800 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-amber-500"
                      style={{ width: `${h.memoryPercent}%` }}
                    />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-[11px] font-mono text-zinc-400 mb-1">
                    <span>Disk Usage</span>
                    <span>{h.diskPercent.toFixed(1)}%</span>
                  </div>
                  <div className="w-full h-1.5 rounded-full bg-zinc-800 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-emerald-500"
                      style={{ width: `${h.diskPercent}%` }}
                    />
                  </div>
                </div>
              </div>

              {/* Tags & OS */}
              <div className="pt-2 border-t border-zinc-800/80 text-[11px] text-zinc-500 space-y-1">
                <p className="truncate">OS: {h.os}</p>
                <div className="flex flex-wrap gap-1 mt-1">
                  {Object.entries(h.tags).map(([k, v]) => (
                    <span
                      key={k}
                      className="px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400 text-[10px] font-mono"
                    >
                      {k}:{v}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Tab 3: Core Dependencies */}
      {activeTab === "dependencies" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {dependencies.map((dep) => (
            <div
              key={dep.name}
              className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5 backdrop-blur-md shadow-2xl space-y-4"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-zinc-800/80 text-emerald-400 border border-zinc-700">
                    <Database className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-base font-bold text-white">{dep.name}</h4>
                    <p className="text-xs text-zinc-400">
                      Ping latency:{" "}
                      <span className="text-white font-mono font-semibold">{dep.latencyMs}ms</span>
                    </p>
                  </div>
                </div>

                <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  {dep.status}
                </span>
              </div>

              {/* Metrics Key-Value Grid */}
              <div className="grid grid-cols-2 gap-2 pt-3 border-t border-zinc-800">
                {Object.entries(dep.details).map(([key, val]) => (
                  <div key={key} className="p-2.5 rounded-xl bg-zinc-950/60 border border-zinc-850">
                    <p className="text-[10px] uppercase font-bold text-zinc-500 tracking-wider">
                      {key.replace(/([A-Z])/g, " $1")}
                    </p>
                    <p className="text-xs font-mono font-semibold text-white mt-0.5 truncate">
                      {String(val)}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
