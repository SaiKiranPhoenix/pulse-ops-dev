import {
  Activity,
  AlertTriangle,
  BarChart3,
  Boxes,
  Building2,
  ChevronDown,
  Clock,
  KeyRound,
  LayoutDashboard,
  LayoutGrid,
  ListPlus,
  LockKeyhole,
  LogOut,
  Menu,
  RadioTower,
  Search,
  SearchCode,
  Server,
  ServerCog,
  Settings,
  ShieldCheck,
  Target,
  UserRound,
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
import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useToast } from "@/components/ui/toast";
import {
  getCurrentUser,
  listOrganizations,
  listProjects,
  type CurrentUser,
  type Organization,
  type Project,
} from "@/features/auth/api";
import { clearAccessToken } from "@/lib/api-client";
import {
  createPulseOpsSocket,
  joinProjectRoom,
  leaveProjectRoom,
  realtimeUrl,
} from "@/lib/socket-client";
import { cn } from "@/lib/utils";

const selectedProjectStorageKey = "pulseops.selectedProjectId";
const selectedOrganizationStorageKey = "pulseops.selectedOrganizationId";
const selectedEnvironmentStorageKey = "pulseops.selectedEnvironment";
const selectedTimeRangeStorageKey = "pulseops.selectedTimeRange";

export const dashboardEnvironments = ["development", "staging", "production"] as const;
const dashboardTimeRanges = ["15m", "1h", "6h", "24h", "7d"] as const;

export type DashboardEnvironment = (typeof dashboardEnvironments)[number];
type DashboardTimeRange = (typeof dashboardTimeRanges)[number];
type RealtimeState = "connected" | "connecting" | "disconnected" | "stale";

export type DashboardContextValue = {
  readonly organizations: Organization[];
  readonly selectedOrganization: Organization | null;
  readonly projects: Project[];
  readonly selectedProject: Project | null;
  readonly selectedEnvironment: DashboardEnvironment;
  readonly selectedTimeRange: DashboardTimeRange;
  readonly isLoadingProjects: boolean;
  readonly projectError: string | null;
  readonly refreshProjects: (preferredProjectId?: string) => Promise<Project[]>;
  readonly refreshOrganizations: (preferredOrgId?: string) => Promise<Organization[]>;
  readonly setSelectedProjectId: (projectId: string) => void;
  readonly setSelectedOrganizationId: (organizationId: string) => void;
  readonly setSelectedEnvironment: (environment: DashboardEnvironment) => void;
};

const DashboardContext = createContext<DashboardContextValue | null>(null);

const navItems = [
  { to: "/dashboard", label: "Overview", icon: LayoutDashboard, end: true },
  { to: "/dashboard/custom", label: "Dashboards", icon: LayoutGrid },
  { to: "/dashboard/explorer", label: "Explorer", icon: Search },
  { to: "/dashboard/services", label: "Services", icon: Boxes },
  { to: "/dashboard/setup", label: "Setup", icon: ListPlus },
  { to: "/dashboard/logs", label: "Logs", icon: SearchCode },
  { to: "/dashboard/errors", label: "Errors", icon: AlertTriangle },
  { to: "/dashboard/metrics", label: "Metrics", icon: BarChart3 },
  { to: "/dashboard/traces", label: "Traces", icon: Activity },
  { to: "/dashboard/infrastructure", label: "Infrastructure", icon: Server },
  { to: "/dashboard/alerts", label: "Incidents", icon: AlertTriangle },
  { to: "/dashboard/slos", label: "SLOs", icon: Target },
  { to: "/dashboard/workers", label: "Workers", icon: RadioTower },
  { to: "/dashboard/vault", label: "Vault", icon: LockKeyhole },
  { to: "/dashboard/vault-audit", label: "Vault Audit", icon: ShieldCheck },
  { to: "/dashboard/api-keys", label: "API Keys", icon: KeyRound },
  { to: "/dashboard/organization", label: "Organization", icon: Building2 },
  { to: "/dashboard/projects", label: "Projects", icon: Settings },
  { to: "/dashboard/platform", label: "Platform", icon: ServerCog },
] as const;

export function DashboardLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { notify } = useToast();
  const [projects, setProjects] = useState<Project[]>([]);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [selectedProjectId, setSelectedProjectIdState] = useState<string | null>(() =>
    localStorage.getItem(selectedProjectStorageKey),
  );
  const [selectedOrganizationId, setSelectedOrganizationIdState] = useState<string | null>(() =>
    localStorage.getItem(selectedOrganizationStorageKey),
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

  const refreshOrganizations = useCallback(
    async (preferredOrgId?: string): Promise<Organization[]> => {
      try {
        const nextOrgs = await listOrganizations();
        setOrganizations(nextOrgs);

        const nextSelectedOrg =
          nextOrgs.find((org) => org.id === preferredOrgId) ??
          nextOrgs.find((org) => org.id === selectedOrganizationId) ??
          nextOrgs[0] ??
          null;

        if (nextSelectedOrg === null) {
          setSelectedOrganizationIdState(null);
          localStorage.removeItem(selectedOrganizationStorageKey);
        } else {
          setSelectedOrganizationIdState(nextSelectedOrg.id);
          localStorage.setItem(selectedOrganizationStorageKey, nextSelectedOrg.id);
        }

        return nextOrgs;
      } catch {
        return [];
      }
    },
    [selectedOrganizationId],
  );

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
        const [projectList, user] = await Promise.all([
          refreshProjects(),
          getCurrentUser(),
          refreshOrganizations(),
        ]);

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

  const selectedOrganization = useMemo(
    () =>
      organizations.find((org) => org.id === selectedOrganizationId) ?? organizations[0] ?? null,
    [organizations, selectedOrganizationId],
  );
  const selectedProject = useMemo(
    () => projects.find((project) => project.id === selectedProjectId) ?? projects[0] ?? null,
    [projects, selectedProjectId],
  );
  const pageTitle = useMemo(() => getPageTitle(location.pathname), [location.pathname]);

  const contextValue = useMemo<DashboardContextValue>(
    () => ({
      organizations,
      selectedOrganization,
      projects,
      selectedProject,
      selectedEnvironment,
      selectedTimeRange,
      isLoadingProjects,
      projectError,
      refreshProjects,
      refreshOrganizations,
      setSelectedProjectId(projectId: string) {
        setSelectedProjectIdState(projectId);
        localStorage.setItem(selectedProjectStorageKey, projectId);
      },
      setSelectedOrganizationId(organizationId: string) {
        setSelectedOrganizationIdState(organizationId);
        localStorage.setItem(selectedOrganizationStorageKey, organizationId);
      },
      setSelectedEnvironment(environment: DashboardEnvironment) {
        setSelectedEnvironmentState(environment);
        localStorage.setItem(selectedEnvironmentStorageKey, environment);
      },
    }),
    [
      isLoadingProjects,
      organizations,
      projectError,
      projects,
      refreshOrganizations,
      refreshProjects,
      selectedEnvironment,
      selectedOrganization,
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
        selectedOrganization={selectedOrganization}
        selectedTimeRange={selectedTimeRange}
        projects={projects}
        organizations={organizations}
        realtimeState={realtimeState}
        setSelectedEnvironment={contextValue.setSelectedEnvironment}
        setSelectedTimeRange={setSelectedTimeRange}
        setSelectedProjectId={contextValue.setSelectedProjectId}
        setSelectedOrganizationId={contextValue.setSelectedOrganizationId}
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
        selectedOrganization={selectedOrganization}
        selectedTimeRange={selectedTimeRange}
        projects={projects}
        organizations={organizations}
        realtimeState={realtimeState}
        setSelectedEnvironment={contextValue.setSelectedEnvironment}
        setSelectedTimeRange={setSelectedTimeRange}
        setSelectedProjectId={contextValue.setSelectedProjectId}
        setSelectedOrganizationId={contextValue.setSelectedOrganizationId}
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
  organizations,
  pageTitle,
  projects,
  realtimeState,
  selectedEnvironment,
  selectedOrganization,
  selectedProject,
  selectedTimeRange,
  setSelectedEnvironment,
  setSelectedTimeRange,
  setIsLogoutConfirmOpen,
  setIsMobileNavOpen,
  setIsUserMenuOpen,
  setSelectedProjectId,
  setSelectedOrganizationId,
}: {
  readonly children: ReactNode;
  readonly currentUser: CurrentUser | null;
  readonly isLogoutConfirmOpen: boolean;
  readonly isMobileNavOpen: boolean;
  readonly isUserMenuOpen: boolean;
  readonly onLogout: () => void;
  readonly organizations: Organization[];
  readonly pageTitle: string;
  readonly projects: Project[];
  readonly realtimeState: RealtimeState;
  readonly selectedEnvironment: DashboardEnvironment;
  readonly selectedOrganization: Organization | null;
  readonly selectedProject: Project | null;
  readonly selectedTimeRange: DashboardTimeRange;
  readonly setSelectedEnvironment: (environment: DashboardEnvironment) => void;
  readonly setSelectedTimeRange: (timeRange: DashboardTimeRange) => void;
  readonly setIsLogoutConfirmOpen: (isOpen: boolean) => void;
  readonly setIsMobileNavOpen: (isOpen: boolean) => void;
  readonly setIsUserMenuOpen: (isOpen: boolean) => void;
  readonly setSelectedProjectId: (projectId: string) => void;
  readonly setSelectedOrganizationId: (organizationId: string) => void;
}) {
  return (
    <div className="min-h-screen bg-background text-foreground lg:grid lg:grid-cols-[15.5rem_1fr]">
      {/* ── Dark glass sidebar ── */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 w-[15.5rem] -translate-x-full bg-navy flex flex-col",
          "border-r border-navy-border transition-transform duration-300 ease-spring",
          "lg:static lg:min-h-screen lg:translate-x-0",
          isMobileNavOpen && "translate-x-0",
        )}
      >
        <SidebarContent
          onNavigate={() => {
            setIsMobileNavOpen(false);
          }}
          organizations={organizations}
          selectedOrganization={selectedOrganization}
          setSelectedOrganizationId={setSelectedOrganizationId}
        />
      </aside>

      {isMobileNavOpen ? (
        <button
          aria-label="Close navigation overlay"
          className="fixed inset-0 z-30 bg-slate-950/40 backdrop-blur-sm lg:hidden"
          onClick={() => {
            setIsMobileNavOpen(false);
          }}
          type="button"
        />
      ) : null}

      <div className="flex min-w-0 flex-col">
        {/* ── Frosted glass topbar ── */}
        <header className="sticky top-0 z-20 topbar-glass px-3 py-3 sm:px-6">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="flex min-w-0 items-center gap-2.5">
              <Button
                aria-label="Open navigation"
                className="h-11 w-11 shrink-0 p-0 lg:hidden"
                onClick={() => {
                  setIsMobileNavOpen(true);
                }}
                type="button"
                variant="ghost"
              >
                <Menu className="h-4 w-4" />
              </Button>
              <div className="min-w-0">
                <p className="section-label leading-none">{pageTitle}</p>
              </div>
            </div>

            <div className="grid w-full grid-cols-1 gap-2 sm:grid-cols-2 md:w-auto md:grid-cols-none md:flex md:flex-wrap md:items-center md:justify-end">
              {/* Project selector */}
              <label className="relative block min-w-0">
                <span className="sr-only">Project</span>
                <select
                  className={cn(
                    "h-11 w-full appearance-none rounded-full border border-border bg-background md:h-8 md:min-w-40",
                    "pl-3 pr-8 text-base font-medium shadow-sm outline-none md:text-xs",
                    "focus:ring-2 focus:ring-ring transition-colors",
                  )}
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
                <ChevronDown className="pointer-events-none absolute right-2.5 top-3.5 h-3.5 w-3.5 text-muted-foreground md:top-2" />
              </label>

              {/* Environment selector */}
              <label className="relative block min-w-0">
                <span className="sr-only">Environment</span>
                <select
                  className={cn(
                    "h-11 w-full appearance-none rounded-full border border-border bg-background md:h-8 md:min-w-32",
                    "pl-3 pr-8 text-base font-medium capitalize shadow-sm outline-none md:text-xs",
                    "focus:ring-2 focus:ring-ring transition-colors",
                  )}
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
                <ChevronDown className="pointer-events-none absolute right-2.5 top-3.5 h-3.5 w-3.5 text-muted-foreground md:top-2" />
              </label>

              {/* Time range selector */}
              <label className="relative block min-w-0">
                <span className="sr-only">Time range</span>
                <select
                  className={cn(
                    "h-11 w-full appearance-none rounded-full border border-border bg-background md:h-8 md:min-w-20",
                    "pl-3 pr-8 text-base font-medium shadow-sm outline-none md:text-xs",
                    "focus:ring-2 focus:ring-ring transition-colors",
                  )}
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
                <Clock className="pointer-events-none absolute right-2.5 top-3.5 h-3.5 w-3.5 text-muted-foreground md:top-2" />
              </label>

              {/* Realtime status pill */}
              <span
                className={cn(
                  "realtime-pill h-11 justify-center md:h-8",
                  realtimeState === "connected" &&
                    "border-emerald-200 bg-emerald-50 text-emerald-700",
                  (realtimeState === "connecting" || realtimeState === "stale") &&
                    "border-amber-200 bg-amber-50 text-amber-700",
                  realtimeState === "disconnected" &&
                    "border-border bg-muted text-muted-foreground",
                )}
                title={realtimeUrl}
              >
                <span
                  className={cn(
                    "realtime-dot",
                    realtimeState === "connected" && "bg-emerald-500 animate-pulse-dot",
                    (realtimeState === "connecting" || realtimeState === "stale") &&
                      "bg-amber-500 animate-pulse-dot",
                    realtimeState === "disconnected" && "bg-slate-400",
                  )}
                />
                {realtimeState}
              </span>

              {/* User menu */}
              <div className="relative">
                <Button
                  className="w-full gap-1.5 px-2.5 md:w-auto"
                  icon={<UserRound className="h-3.5 w-3.5" />}
                  onClick={() => {
                    setIsUserMenuOpen(!isUserMenuOpen);
                  }}
                  type="button"
                  variant="ghost"
                >
                  <span className="max-w-full truncate text-sm md:max-w-28 md:text-xs">
                    {currentUser?.name ?? currentUser?.email ?? "Account"}
                  </span>
                  <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                </Button>

                {isUserMenuOpen ? (
                  <div
                    className={cn(
                      "absolute right-0 z-30 mt-2 w-[min(13rem,calc(100vw-1.5rem))] rounded-xl border border-border bg-card p-1.5 text-sm",
                      "shadow-float animate-fade-in",
                    )}
                  >
                    <Link
                      className="flex items-center gap-2 rounded-lg px-3 py-2 text-foreground/80 transition-colors hover:bg-accent hover:text-foreground"
                      onClick={() => {
                        setIsUserMenuOpen(false);
                      }}
                      to="/dashboard/account"
                    >
                      <UserRound className="h-3.5 w-3.5" />
                      Account settings
                    </Link>
                    <Link
                      className="flex items-center gap-2 rounded-lg px-3 py-2 text-foreground/80 transition-colors hover:bg-accent hover:text-foreground"
                      onClick={() => {
                        setIsUserMenuOpen(false);
                      }}
                      to="/dashboard/organization"
                    >
                      <Building2 className="h-3.5 w-3.5" />
                      Organization & Team
                    </Link>
                    <Link
                      className="flex items-center gap-2 rounded-lg px-3 py-2 text-foreground/80 transition-colors hover:bg-accent hover:text-foreground"
                      onClick={() => {
                        setIsUserMenuOpen(false);
                      }}
                      to="/dashboard/projects"
                    >
                      <Settings className="h-3.5 w-3.5" />
                      Projects
                    </Link>
                    <div className="my-1 h-px bg-border" />
                    <button
                      className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-destructive transition-colors hover:bg-destructive/10"
                      onClick={() => {
                        setIsUserMenuOpen(false);
                        setIsLogoutConfirmOpen(true);
                      }}
                      type="button"
                    >
                      <LogOut className="h-3.5 w-3.5" />
                      Sign out
                    </button>
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </header>

        <div className="flex-1 px-3 py-4 sm:px-6 sm:py-5 lg:px-8">
          <div className="page-enter">{children}</div>
        </div>
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

function SidebarContent({
  onNavigate,
  organizations,
  selectedOrganization,
  setSelectedOrganizationId,
}: {
  readonly onNavigate: () => void;
  readonly organizations: Organization[];
  readonly selectedOrganization: Organization | null;
  readonly setSelectedOrganizationId: (orgId: string) => void;
}) {
  return (
    <div className="flex flex-col h-full">
      {/* Wordmark */}
      <div className="flex items-center justify-between gap-3 px-4 py-4 border-b border-navy-border">
        <Link className="flex items-center gap-2.5" onClick={onNavigate} to="/dashboard">
          <span
            className={cn(
              "grid h-8 w-8 place-items-center rounded-lg text-xs font-black text-white",
              "bg-gradient-to-br from-indigo-500 to-violet-600 shadow-glow-sm",
            )}
          >
            PO
          </span>
          <div>
            <p className="text-sm font-semibold text-white tracking-tight">PulseOps</p>
            <p className="text-[11px] text-navy-muted">Control plane</p>
          </div>
        </Link>
        <Button
          aria-label="Close navigation"
          className="h-7 w-7 p-0 lg:hidden text-navy-muted hover:text-white hover:bg-navy-subtle"
          onClick={onNavigate}
          type="button"
          variant="ghost"
        >
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>

      {/* ── Organization Switcher Widget ── */}
      <div className="px-3 pt-3 pb-2 border-b border-navy-border/70">
        <div className="rounded-lg bg-navy-subtle/80 p-2 border border-navy-border/60">
          <div className="flex items-center justify-between gap-2 mb-1.5">
            <div className="flex items-center gap-1.5 min-w-0">
              <Building2 className="h-3.5 w-3.5 text-indigo-400 shrink-0" />
              <span className="text-xs font-semibold text-white truncate">
                {selectedOrganization?.name ?? "My Workspace"}
              </span>
            </div>
            {selectedOrganization ? (
              <span
                className={cn(
                  "px-1.5 py-0.5 rounded text-[10px] font-bold tracking-wider uppercase shrink-0",
                  selectedOrganization.role === "owner" &&
                    "bg-amber-500/20 text-amber-300 border border-amber-500/30",
                  selectedOrganization.role === "admin" &&
                    "bg-indigo-500/20 text-indigo-300 border border-indigo-500/30",
                  selectedOrganization.role === "developer" &&
                    "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30",
                  selectedOrganization.role === "viewer" &&
                    "bg-slate-500/20 text-slate-300 border border-slate-500/30",
                )}
              >
                {selectedOrganization.role}
              </span>
            ) : null}
          </div>

          <label className="relative block">
            <span className="sr-only">Switch organization</span>
            <select
              aria-label="Select organization"
              className={cn(
                "h-7 w-full appearance-none rounded-md border border-navy-border bg-navy/90 text-[11px] font-medium text-slate-200",
                "pl-2 pr-6 outline-none focus:ring-1 focus:ring-indigo-400 transition-colors",
              )}
              disabled={organizations.length === 0}
              onChange={(event) => {
                setSelectedOrganizationId(event.target.value);
              }}
              value={selectedOrganization?.id ?? ""}
            >
              {organizations.length === 0 ? <option>No organizations</option> : null}
              {organizations.map((org) => (
                <option key={org.id} value={org.id}>
                  {org.name} ({org.role})
                </option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-1.5 top-2 h-3 w-3 text-navy-muted" />
          </label>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto sidebar-scroll px-3 py-3 grid gap-0.5">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              className={({ isActive }) => cn("nav-item", isActive && "active")}
              end={"end" in item ? item.end : undefined}
              key={item.to}
              onClick={onNavigate}
              to={item.to}
            >
              <Icon className="h-3.5 w-3.5 shrink-0" />
              {item.label}
            </NavLink>
          );
        })}
      </nav>

      {/* Footer stack status */}
      <div className="px-3 pb-4">
        <div className="rounded-lg border border-navy-border bg-navy-subtle/50 p-3">
          <div className="flex items-center gap-2">
            <RadioTower className="h-3.5 w-3.5 text-indigo-400" />
            <span className="text-xs font-semibold text-white/80">Local stack</span>
          </div>
          <p className="mt-2 text-[11px] text-navy-muted">API · localhost:4000</p>
          <p className="text-[11px] text-navy-muted">Realtime · localhost:4130</p>
        </div>
      </div>
    </div>
  );
}

function DashboardLoadingShell() {
  return (
    <main className="min-h-screen bg-background text-foreground lg:grid lg:grid-cols-[15.5rem_1fr]">
      {/* Sidebar shimmer */}
      <aside className="hidden border-r border-navy-border bg-navy p-4 lg:block">
        <div className="flex items-center gap-2.5 border-b border-navy-border pb-4">
          <div className="skeleton-dark h-8 w-8 rounded-lg" />
          <div className="space-y-1.5">
            <div className="skeleton-dark h-3 w-20" />
            <div className="skeleton-dark h-2.5 w-14" />
          </div>
        </div>
        <div className="mt-4 grid gap-1">
          {Array.from({ length: 12 }).map((_, index) => (
            <div className="skeleton-dark h-8" key={index} style={{ opacity: 1 - index * 0.06 }} />
          ))}
        </div>
      </aside>
      {/* Content shimmer */}
      <div>
        <header className="topbar-glass px-4 py-2.5 sm:px-6">
          <div className="flex items-center justify-between">
            <div className="skeleton h-4 w-24" />
            <div className="flex gap-2">
              {Array.from({ length: 4 }).map((_, index) => (
                <div className="skeleton h-8 w-28 rounded-full" key={index} />
              ))}
            </div>
          </div>
        </header>
        <div className="grid gap-4 p-4 sm:p-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, index) => (
              <div className="skeleton h-24 rounded-xl" key={index} />
            ))}
          </div>
          <div className="skeleton h-48 rounded-xl" />
          <div className="grid gap-4 xl:grid-cols-2">
            {Array.from({ length: 2 }).map((_, index) => (
              <div className="skeleton h-36 rounded-xl" key={index} />
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

  if (pathname === "/dashboard/organization") {
    return "Organization & Teams";
  }

  return activeItem?.label ?? "Dashboard";
}
