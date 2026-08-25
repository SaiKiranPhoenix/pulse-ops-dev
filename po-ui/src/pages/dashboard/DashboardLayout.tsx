import {
  Activity,
  AlertTriangle,
  BarChart3,
  ChevronDown,
  Clock,
  KeyRound,
  LayoutDashboard,
  ListPlus,
  LockKeyhole,
  LogOut,
  Menu,
  RadioTower,
  SearchCode,
  ServerCog,
  Settings,
  ShieldCheck,
  UserRound,
  Wifi,
  WifiOff,
  X,
} from "lucide-react";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { Link, Navigate, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useToast } from "@/components/ui/toast";
import { getCurrentUser, listProjects, type CurrentUser, type Project } from "@/features/auth/api";
import { clearAccessToken } from "@/lib/api-client";
import {
  createPulseOpsSocket,
  joinProjectRoom,
  leaveProjectRoom,
  realtimeUrl,
} from "@/lib/socket-client";
import { cn } from "@/lib/utils";

const selectedProjectStorageKey = "pulseops.selectedProjectId";
const selectedEnvironmentStorageKey = "pulseops.selectedEnvironment";
const selectedTimeRangeStorageKey = "pulseops.selectedTimeRange";

export const dashboardEnvironments = ["development", "staging", "production"] as const;
const dashboardTimeRanges = ["15m", "1h", "6h", "24h", "7d"] as const;

export type DashboardEnvironment = (typeof dashboardEnvironments)[number];
type DashboardTimeRange = (typeof dashboardTimeRanges)[number];
type RealtimeState = "connected" | "connecting" | "disconnected" | "stale";

export type DashboardContextValue = {
  readonly projects: Project[];
  readonly selectedProject: Project | null;
  readonly selectedEnvironment: DashboardEnvironment;
  readonly selectedTimeRange: DashboardTimeRange;
  readonly isLoadingProjects: boolean;
  readonly projectError: string | null;
  readonly refreshProjects: (preferredProjectId?: string) => Promise<Project[]>;
  readonly setSelectedProjectId: (projectId: string) => void;
  readonly setSelectedEnvironment: (environment: DashboardEnvironment) => void;
};

const DashboardContext = createContext<DashboardContextValue | null>(null);

const navItems = [
  { to: "/dashboard", label: "Overview", icon: LayoutDashboard, end: true },
  { to: "/dashboard/setup", label: "Setup", icon: ListPlus },
  { to: "/dashboard/logs", label: "Logs", icon: SearchCode },
  { to: "/dashboard/errors", label: "Errors", icon: AlertTriangle },
  { to: "/dashboard/metrics", label: "Metrics", icon: BarChart3 },
  { to: "/dashboard/traces", label: "Traces", icon: Activity },
  { to: "/dashboard/alerts", label: "Incidents", icon: AlertTriangle },
  { to: "/dashboard/workers", label: "Workers", icon: RadioTower },
  { to: "/dashboard/vault", label: "Vault", icon: LockKeyhole },
  { to: "/dashboard/vault-audit", label: "Vault Audit", icon: ShieldCheck },
  { to: "/dashboard/api-keys", label: "API Keys", icon: KeyRound },
  { to: "/dashboard/projects", label: "Projects", icon: Settings },
  { to: "/dashboard/platform", label: "Platform", icon: ServerCog },
] as const;

export function DashboardLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { notify } = useToast();
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectIdState] = useState<string | null>(() =>
    localStorage.getItem(selectedProjectStorageKey),
  );
  const [selectedEnvironment, setSelectedEnvironmentState] = useState<DashboardEnvironment>(() => {
    const saved = localStorage.getItem(selectedEnvironmentStorageKey);
    return isDashboardEnvironment(saved) ? saved : "production";
  });
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [isLoadingProjects, setIsLoadingProjects] = useState(true);
  const [projectError, setProjectError] = useState<string | null>(null);
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isLogoutConfirmOpen, setIsLogoutConfirmOpen] = useState(false);
  const [realtimeState, setRealtimeState] = useState<RealtimeState>("disconnected");
  const [, setLastRealtimeAt] = useState<number | null>(null);
  const [selectedTimeRange, setSelectedTimeRangeState] = useState<DashboardTimeRange>(() => {
    const saved = localStorage.getItem(selectedTimeRangeStorageKey);
    return isDashboardTimeRange(saved) ? saved : "1h";
  });

  const refreshProjects = useCallback(
    async (preferredProjectId?: string): Promise<Project[]> => {
      setProjectError(null);
      const nextProjects = await listProjects();
      setProjects(nextProjects);

      const nextSelectedProject =
        nextProjects.find((project) => project.id === preferredProjectId) ??
        nextProjects.find((project) => project.id === selectedProjectId) ??
        nextProjects.find((project) => project.status === "active") ??
        nextProjects[0] ??
        null;

      if (nextSelectedProject === null) {
        setSelectedProjectIdState(null);
        localStorage.removeItem(selectedProjectStorageKey);
      } else {
        setSelectedProjectIdState(nextSelectedProject.id);
        localStorage.setItem(selectedProjectStorageKey, nextSelectedProject.id);
      }

      return nextProjects;
    },
    [selectedProjectId],
  );

  useEffect(() => {
    let isMounted = true;

    async function loadShell(): Promise<void> {
      setIsLoadingProjects(true);
      try {
        const [projectList, user] = await Promise.all([refreshProjects(), getCurrentUser()]);

        if (!isMounted) {
          return;
        }

        setCurrentUser(user);
        setProjects(projectList);
      } catch {
        if (isMounted) {
          setProjectError("Project workspace is unavailable.");
        }
      } finally {
        if (isMounted) {
          setIsLoadingProjects(false);
        }
      }
    }

    void loadShell();

    return () => {
      isMounted = false;
    };
  }, [refreshProjects]);

  const selectedProject = useMemo(
    () => projects.find((project) => project.id === selectedProjectId) ?? projects[0] ?? null,
    [projects, selectedProjectId],
  );
  const pageTitle = useMemo(() => getPageTitle(location.pathname), [location.pathname]);

  const contextValue = useMemo<DashboardContextValue>(
    () => ({
      projects,
      selectedProject,
      selectedEnvironment,
      selectedTimeRange,
      isLoadingProjects,
      projectError,
      refreshProjects,
      setSelectedProjectId(projectId: string) {
        setSelectedProjectIdState(projectId);
        localStorage.setItem(selectedProjectStorageKey, projectId);
      },
      setSelectedEnvironment(environment: DashboardEnvironment) {
        setSelectedEnvironmentState(environment);
        localStorage.setItem(selectedEnvironmentStorageKey, environment);
      },
    }),
    [
      isLoadingProjects,
      projectError,
      projects,
      refreshProjects,
      selectedEnvironment,
      selectedProject,
      selectedTimeRange,
    ],
  );

  function logout(): void {
    clearAccessToken();
    notify({ title: "Signed out", variant: "info" });
    navigate("/login", { replace: true });
  }

  function setSelectedTimeRange(timeRange: DashboardTimeRange): void {
    setSelectedTimeRangeState(timeRange);
    localStorage.setItem(selectedTimeRangeStorageKey, timeRange);
  }

  useEffect(() => {
    if (selectedProject === null) {
      setRealtimeState("disconnected");
      return;
    }

    const socket = createPulseOpsSocket();

    if (socket === null) {
      setRealtimeState("disconnected");
      return;
    }

    setRealtimeState("connecting");
    socket.on("connect", () => {
      setRealtimeState("connected");
      setLastRealtimeAt(Date.now());
      void joinProjectRoom(socket, selectedProject.id, selectedEnvironment);
    });
    socket.on("project:joined", () => {
      setLastRealtimeAt(Date.now());
      setRealtimeState("connected");
    });
    socket.on("disconnect", () => {
      setRealtimeState("disconnected");
    });
    socket.on("connect_error", () => {
      setRealtimeState("disconnected");
    });
    socket.connect();
    const staleInterval = window.setInterval(() => {
      setLastRealtimeAt((lastSeenAt) => {
        if (lastSeenAt !== null && Date.now() - lastSeenAt > 45_000) {
          setRealtimeState((current) => (current === "connected" ? "stale" : current));
        }

        return lastSeenAt;
      });
    }, 15_000);

    return () => {
      window.clearInterval(staleInterval);
      leaveProjectRoom(socket, selectedProject.id, selectedEnvironment);
      socket.disconnect();
    };
  }, [selectedEnvironment, selectedProject]);

  if (isLoadingProjects) {
    return <DashboardLoadingShell />;
  }

  if (projectError !== null) {
    return (
      <DashboardFrame
        currentUser={currentUser}
        isLogoutConfirmOpen={isLogoutConfirmOpen}
        isMobileNavOpen={isMobileNavOpen}
        isUserMenuOpen={isUserMenuOpen}
        onLogout={logout}
        pageTitle={pageTitle}
        selectedEnvironment={selectedEnvironment}
        selectedProject={selectedProject}
        selectedTimeRange={selectedTimeRange}
        projects={projects}
        realtimeState={realtimeState}
        setSelectedEnvironment={contextValue.setSelectedEnvironment}
        setSelectedTimeRange={setSelectedTimeRange}
        setSelectedProjectId={contextValue.setSelectedProjectId}
        setIsLogoutConfirmOpen={setIsLogoutConfirmOpen}
        setIsMobileNavOpen={setIsMobileNavOpen}
        setIsUserMenuOpen={setIsUserMenuOpen}
      >
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <p>{projectError}</p>
          <Button
            className="mt-3 w-auto"
            onClick={() => {
              window.location.reload();
            }}
            type="button"
            variant="outline"
          >
            Retry
          </Button>
        </div>
      </DashboardFrame>
    );
  }

  if (
    projects.length === 0 &&
    location.pathname !== "/dashboard/setup" &&
    location.pathname !== "/dashboard/projects"
  ) {
    return <Navigate to="/dashboard/setup" replace />;
  }

  return (
    <DashboardContext.Provider value={contextValue}>
      <DashboardFrame
        currentUser={currentUser}
        isLogoutConfirmOpen={isLogoutConfirmOpen}
        isMobileNavOpen={isMobileNavOpen}
        isUserMenuOpen={isUserMenuOpen}
        onLogout={logout}
        pageTitle={pageTitle}
        selectedEnvironment={selectedEnvironment}
        selectedProject={selectedProject}
        selectedTimeRange={selectedTimeRange}
        projects={projects}
        realtimeState={realtimeState}
        setSelectedEnvironment={contextValue.setSelectedEnvironment}
        setSelectedTimeRange={setSelectedTimeRange}
        setSelectedProjectId={contextValue.setSelectedProjectId}
        setIsLogoutConfirmOpen={setIsLogoutConfirmOpen}
        setIsMobileNavOpen={setIsMobileNavOpen}
        setIsUserMenuOpen={setIsUserMenuOpen}
      >
        <Outlet context={contextValue} />
      </DashboardFrame>
    </DashboardContext.Provider>
  );
}

export function useDashboardContext(): DashboardContextValue {
  const context = useContext(DashboardContext);

  if (context === null) {
    throw new Error("useDashboardContext must be used inside DashboardLayout");
  }

  return context;
}

function DashboardFrame({
  children,
  currentUser,
  isLogoutConfirmOpen,
  isMobileNavOpen,
  isUserMenuOpen,
  onLogout,
  pageTitle,
  projects,
  realtimeState,
  selectedEnvironment,
  selectedProject,
  selectedTimeRange,
  setSelectedEnvironment,
  setSelectedTimeRange,
  setIsLogoutConfirmOpen,
  setIsMobileNavOpen,
  setIsUserMenuOpen,
  setSelectedProjectId,
}: {
  readonly children: ReactNode;
  readonly currentUser: CurrentUser | null;
  readonly isLogoutConfirmOpen: boolean;
  readonly isMobileNavOpen: boolean;
  readonly isUserMenuOpen: boolean;
  readonly onLogout: () => void;
  readonly pageTitle: string;
  readonly projects: Project[];
  readonly realtimeState: RealtimeState;
  readonly selectedEnvironment: DashboardEnvironment;
  readonly selectedProject: Project | null;
  readonly selectedTimeRange: DashboardTimeRange;
  readonly setSelectedEnvironment: (environment: DashboardEnvironment) => void;
  readonly setSelectedTimeRange: (timeRange: DashboardTimeRange) => void;
  readonly setIsLogoutConfirmOpen: (isOpen: boolean) => void;
  readonly setIsMobileNavOpen: (isOpen: boolean) => void;
  readonly setIsUserMenuOpen: (isOpen: boolean) => void;
  readonly setSelectedProjectId: (projectId: string) => void;
}) {
  const RealtimeIcon = realtimeState === "connected" ? Wifi : WifiOff;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-950 lg:grid lg:grid-cols-[16rem_1fr]">
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 w-64 -translate-x-full border-r border-slate-200 bg-white px-4 py-4 transition-transform lg:static lg:min-h-screen lg:translate-x-0",
          isMobileNavOpen && "translate-x-0",
        )}
      >
        <SidebarContent
          onNavigate={() => {
            setIsMobileNavOpen(false);
          }}
        />
      </aside>

      {isMobileNavOpen ? (
        <button
          aria-label="Close navigation overlay"
          className="fixed inset-0 z-30 bg-slate-950/30 lg:hidden"
          onClick={() => {
            setIsMobileNavOpen(false);
          }}
          type="button"
        />
      ) : null}

      <div className="min-w-0">
        <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 px-4 py-3 backdrop-blur sm:px-6 lg:px-8">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex min-w-0 items-center gap-3">
              <Button
                aria-label="Open navigation"
                className="h-10 w-10 shrink-0 p-0 lg:hidden"
                onClick={() => {
                  setIsMobileNavOpen(true);
                }}
                type="button"
                variant="outline"
              >
                <Menu className="h-4 w-4" />
              </Button>
              <div className="min-w-0">
                <p className="text-xs font-medium uppercase tracking-normal text-slate-500">
                  Dashboard / {pageTitle}
                </p>
                <h1 className="truncate text-lg font-semibold">{pageTitle}</h1>
              </div>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <label className="relative block">
                <span className="sr-only">Project</span>
                <select
                  className="h-10 min-w-48 appearance-none rounded-md border border-slate-200 bg-white px-3 pr-9 text-sm shadow-sm outline-none focus:ring-2 focus:ring-cyan-700"
                  disabled={projects.length === 0}
                  onChange={(event) => {
                    setSelectedProjectId(event.target.value);
                  }}
                  value={selectedProject?.id ?? ""}
                >
                  {projects.length === 0 ? <option>No projects</option> : null}
                  {projects.map((project) => (
                    <option key={project.id} value={project.id}>
                      {project.name}
                    </option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-3 top-3 h-4 w-4 text-slate-500" />
              </label>

              <label className="relative block">
                <span className="sr-only">Environment</span>
                <select
                  className="h-10 min-w-40 appearance-none rounded-md border border-slate-200 bg-white px-3 pr-9 text-sm capitalize shadow-sm outline-none focus:ring-2 focus:ring-cyan-700"
                  onChange={(event) => {
                    if (isDashboardEnvironment(event.target.value)) {
                      setSelectedEnvironment(event.target.value);
                    }
                  }}
                  value={selectedEnvironment}
                >
                  {dashboardEnvironments.map((environment) => (
                    <option key={environment} value={environment}>
                      {environment}
                    </option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-3 top-3 h-4 w-4 text-slate-500" />
              </label>

              <label className="relative block">
                <span className="sr-only">Time range</span>
                <select
                  className="h-10 min-w-28 appearance-none rounded-md border border-slate-200 bg-white px-3 pr-9 text-sm shadow-sm outline-none focus:ring-2 focus:ring-cyan-700"
                  onChange={(event) => {
                    if (isDashboardTimeRange(event.target.value)) {
                      setSelectedTimeRange(event.target.value);
                    }
                  }}
                  value={selectedTimeRange}
                >
                  {dashboardTimeRanges.map((timeRange) => (
                    <option key={timeRange} value={timeRange}>
                      {timeRange}
                    </option>
                  ))}
                </select>
                <Clock className="pointer-events-none absolute right-3 top-3 h-4 w-4 text-slate-500" />
              </label>

              <Button asChild className="w-auto" variant="outline">
                <Link to="/dashboard/projects">
                  <Settings className="h-4 w-4" />
                  Projects
                </Link>
              </Button>

              <span
                className={cn(
                  "inline-flex h-10 items-center gap-2 rounded-md border px-3 text-sm",
                  realtimeState === "connected" &&
                    "border-emerald-200 bg-emerald-50 text-emerald-800",
                  realtimeState === "connecting" && "border-amber-200 bg-amber-50 text-amber-800",
                  realtimeState === "stale" && "border-amber-200 bg-amber-50 text-amber-800",
                  realtimeState === "disconnected" && "border-slate-200 bg-slate-50 text-slate-600",
                )}
                title={realtimeUrl}
              >
                <RealtimeIcon className="h-4 w-4" />
                {realtimeState}
              </span>

              <div className="relative">
                <Button
                  className="w-full justify-between sm:w-52"
                  icon={<UserRound className="h-4 w-4" />}
                  onClick={() => {
                    setIsUserMenuOpen(!isUserMenuOpen);
                  }}
                  type="button"
                  variant="ghost"
                >
                  <span className="truncate">
                    {currentUser?.name ?? currentUser?.email ?? "Account"}
                  </span>
                  <ChevronDown className="h-4 w-4" />
                </Button>

                {isUserMenuOpen ? (
                  <div className="absolute right-0 z-30 mt-2 w-56 rounded-md border border-slate-200 bg-white p-2 text-sm shadow-lg">
                    <Link
                      className="flex items-center gap-2 rounded-md px-3 py-2 text-slate-700 hover:bg-slate-100"
                      onClick={() => {
                        setIsUserMenuOpen(false);
                      }}
                      to="/dashboard/account"
                    >
                      <UserRound className="h-4 w-4" />
                      Account settings
                    </Link>
                    <button
                      className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-red-700 hover:bg-red-50"
                      onClick={() => {
                        setIsUserMenuOpen(false);
                        setIsLogoutConfirmOpen(true);
                      }}
                      type="button"
                    >
                      <LogOut className="h-4 w-4" />
                      Sign out
                    </button>
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </header>

        <div className="px-4 py-5 sm:px-6 lg:px-8">{children}</div>
      </div>

      <ConfirmDialog
        confirmLabel="Sign out"
        description="This clears the local session token and returns you to the sign-in page."
        isOpen={isLogoutConfirmOpen}
        onCancel={() => {
          setIsLogoutConfirmOpen(false);
        }}
        onConfirm={() => {
          setIsLogoutConfirmOpen(false);
          onLogout();
        }}
        title="Sign out?"
      />
    </div>
  );
}

function SidebarContent({ onNavigate }: { readonly onNavigate: () => void }) {
  return (
    <>
      <div className="flex items-center justify-between gap-3">
        <Link className="flex items-center gap-3" onClick={onNavigate} to="/dashboard">
          <span className="grid h-10 w-10 place-items-center rounded-md bg-slate-950 text-sm font-black text-white">
            PO
          </span>
          <div>
            <p className="text-sm font-semibold">PulseOps</p>
            <p className="text-xs text-slate-500">Control plane</p>
          </div>
        </Link>
        <Button
          aria-label="Close navigation"
          className="h-9 w-9 p-0 lg:hidden"
          onClick={onNavigate}
          type="button"
          variant="ghost"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      <nav className="mt-5 grid gap-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100 hover:text-slate-950",
                  isActive && "bg-slate-950 text-white hover:bg-slate-950 hover:text-white",
                )
              }
              end={"end" in item ? item.end : undefined}
              key={item.to}
              onClick={onNavigate}
              to={item.to}
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </NavLink>
          );
        })}
      </nav>

      <div className="mt-6 rounded-md border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
        <div className="flex items-center gap-2 font-medium text-slate-900">
          <RadioTower className="h-4 w-4 text-cyan-700" />
          Local stack
        </div>
        <p className="mt-2">API gateway on localhost:4000</p>
        <p>Realtime on localhost:4130</p>
      </div>
    </>
  );
}

function DashboardLoadingShell() {
  return (
    <main className="min-h-screen bg-slate-50 text-slate-600 lg:grid lg:grid-cols-[16rem_1fr]">
      <aside className="hidden border-r border-slate-200 bg-white p-4 lg:block">
        <div className="h-10 w-32 animate-pulse rounded-md bg-slate-200" />
        <div className="mt-6 grid gap-2">
          {Array.from({ length: 10 }).map((_, index) => (
            <div className="h-9 animate-pulse rounded-md bg-slate-100" key={index} />
          ))}
        </div>
      </aside>
      <div>
        <header className="border-b border-slate-200 bg-white px-4 py-3 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <div className="h-3 w-28 animate-pulse rounded bg-slate-200" />
              <div className="mt-2 h-6 w-52 animate-pulse rounded bg-slate-200" />
            </div>
            <div className="flex flex-wrap gap-2">
              {Array.from({ length: 4 }).map((_, index) => (
                <div className="h-10 w-32 animate-pulse rounded-md bg-slate-200" key={index} />
              ))}
            </div>
          </div>
        </header>
        <div className="grid gap-4 p-4 sm:p-6 lg:p-8">
          <div className="h-40 animate-pulse rounded-md bg-slate-200" />
          <div className="grid gap-4 xl:grid-cols-3">
            {Array.from({ length: 3 }).map((_, index) => (
              <div className="h-36 animate-pulse rounded-md bg-slate-200" key={index} />
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}

function isDashboardEnvironment(value: string | null): value is DashboardEnvironment {
  return dashboardEnvironments.some((environment) => environment === value);
}

function isDashboardTimeRange(value: string | null): value is DashboardTimeRange {
  return dashboardTimeRanges.some((timeRange) => timeRange === value);
}

function getPageTitle(pathname: string): string {
  const activeItem =
    navItems
      .filter((item) =>
        item.to === "/dashboard" ? pathname === item.to : pathname.startsWith(item.to),
      )
      .sort((first, second) => second.to.length - first.to.length)[0] ?? null;

  if (pathname === "/dashboard/account") {
    return "Account Settings";
  }

  return activeItem?.label ?? "Dashboard";
}
