import {
  Activity,
  AlertTriangle,
  BarChart3,
  ChevronDown,
  KeyRound,
  LayoutDashboard,
  ListPlus,
  LockKeyhole,
  LogOut,
  RadioTower,
  SearchCode,
  Settings,
  ShieldCheck,
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
import { getCurrentUser, listProjects, type CurrentUser, type Project } from "@/features/auth/api";
import { clearAccessToken } from "@/lib/api-client";
import { cn } from "@/lib/utils";

const selectedProjectStorageKey = "pulseops.selectedProjectId";
const selectedEnvironmentStorageKey = "pulseops.selectedEnvironment";

export const dashboardEnvironments = ["development", "staging", "production"] as const;

export type DashboardEnvironment = (typeof dashboardEnvironments)[number];

export type DashboardContextValue = {
  readonly projects: Project[];
  readonly selectedProject: Project | null;
  readonly selectedEnvironment: DashboardEnvironment;
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
] as const;

export function DashboardLayout() {
  const navigate = useNavigate();
  const location = useLocation();
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

  const refreshProjects = useCallback(
    async (preferredProjectId?: string): Promise<Project[]> => {
      setProjectError(null);
      const nextProjects = await listProjects();
      setProjects(nextProjects);

      const nextSelectedProject =
        nextProjects.find((project) => project.id === preferredProjectId) ??
        nextProjects.find((project) => project.id === selectedProjectId) ??
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

  const contextValue = useMemo<DashboardContextValue>(
    () => ({
      projects,
      selectedProject,
      selectedEnvironment,
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
    ],
  );

  function logout(): void {
    clearAccessToken();
    navigate("/login", { replace: true });
  }

  if (isLoadingProjects) {
    return <DashboardLoadingShell />;
  }

  if (projectError !== null) {
    return (
      <DashboardFrame
        currentUser={currentUser}
        onLogout={logout}
        selectedEnvironment={selectedEnvironment}
        selectedProject={selectedProject}
        projects={projects}
        setSelectedEnvironment={contextValue.setSelectedEnvironment}
        setSelectedProjectId={contextValue.setSelectedProjectId}
      >
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {projectError}
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
        onLogout={logout}
        selectedEnvironment={selectedEnvironment}
        selectedProject={selectedProject}
        projects={projects}
        setSelectedEnvironment={contextValue.setSelectedEnvironment}
        setSelectedProjectId={contextValue.setSelectedProjectId}
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
  onLogout,
  projects,
  selectedEnvironment,
  selectedProject,
  setSelectedEnvironment,
  setSelectedProjectId,
}: {
  readonly children: ReactNode;
  readonly currentUser: CurrentUser | null;
  readonly onLogout: () => void;
  readonly projects: Project[];
  readonly selectedEnvironment: DashboardEnvironment;
  readonly selectedProject: Project | null;
  readonly setSelectedEnvironment: (environment: DashboardEnvironment) => void;
  readonly setSelectedProjectId: (projectId: string) => void;
}) {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-950 lg:grid lg:grid-cols-[16rem_1fr]">
      <aside className="border-b border-slate-200 bg-white px-4 py-4 lg:min-h-screen lg:border-b-0 lg:border-r">
        <div className="flex items-center justify-between gap-3 lg:block">
          <Link className="flex items-center gap-3" to="/dashboard">
            <span className="grid h-10 w-10 place-items-center rounded-md bg-slate-950 text-sm font-black text-white">
              PO
            </span>
            <div>
              <p className="text-sm font-semibold">PulseOps</p>
              <p className="text-xs text-slate-500">Control plane</p>
            </div>
          </Link>
          <Button className="w-auto lg:hidden" onClick={onLogout} type="button" variant="ghost">
            <LogOut className="h-4 w-4" />
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
                to={item.to}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </NavLink>
            );
          })}
        </nav>

        <div className="mt-6 hidden rounded-md border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600 lg:block">
          <div className="flex items-center gap-2 font-medium text-slate-900">
            <RadioTower className="h-4 w-4 text-cyan-700" />
            Local stack
          </div>
          <p className="mt-2">API gateway on localhost:4000</p>
          <p>Dashboard on localhost:3000</p>
        </div>
      </aside>

      <div className="min-w-0">
        <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 px-4 py-3 backdrop-blur sm:px-6 lg:px-8">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <div className="min-w-0">
              <p className="text-xs font-medium uppercase tracking-normal text-slate-500">
                {selectedProject?.slug ?? "setup required"}
              </p>
              <h1 className="truncate text-lg font-semibold">
                {selectedProject?.name ?? "Create your first project"}
              </h1>
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

              <Button asChild className="w-auto" variant="outline">
                <Link to="/dashboard/projects">
                  <Settings className="h-4 w-4" />
                  Projects
                </Link>
              </Button>

              <Button
                className="hidden w-auto lg:inline-flex"
                onClick={onLogout}
                type="button"
                variant="ghost"
              >
                <LogOut className="h-4 w-4" />
                {currentUser?.name ?? currentUser?.email ?? "Sign out"}
              </Button>
            </div>
          </div>
        </header>

        <div className="px-4 py-5 sm:px-6 lg:px-8">{children}</div>
      </div>
    </div>
  );
}

function DashboardLoadingShell() {
  return (
    <main className="grid min-h-screen place-items-center bg-slate-50 px-6 text-slate-600">
      <div className="rounded-md border border-slate-200 bg-white p-5 text-sm shadow-sm">
        Loading workspace...
      </div>
    </main>
  );
}

function isDashboardEnvironment(value: string | null): value is DashboardEnvironment {
  return dashboardEnvironments.some((environment) => environment === value);
}
