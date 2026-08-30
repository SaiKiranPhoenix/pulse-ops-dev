import {
  CheckCircle2,
  ChevronRight,
  Clipboard,
  FolderKanban,
  Loader2,
  Plus,
  RadioTower,
  Settings,
  Terminal,
  Undo2,
} from "lucide-react";
import { type FormEvent, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Input } from "@/components/ui/input";
import { archiveProject, createProject, restoreProject, type Project } from "@/features/auth/api";
import { apiClient, getApiErrorMessage } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import {
  dashboardEnvironments,
  type DashboardEnvironment,
  useDashboardContext,
} from "./DashboardLayout";
import { formatRelativeTime } from "./dashboard-utils";

const environmentsStorageKey = "pulseops.projectEnvironments";

type ProjectEnvironmentState = Record<string, Record<DashboardEnvironment, boolean>>;

export function ProjectSettingsPage() {
  const {
    projects,
    refreshProjects,
    selectedEnvironment,
    selectedProject,
    setSelectedEnvironment,
    setSelectedProjectId,
  } = useDashboardContext();
  const [projectName, setProjectName] = useState("");
  const [projectSlug, setProjectSlug] = useState("");
  const [projectDescription, setProjectDescription] = useState("");
  const [pendingLifecycleAction, setPendingLifecycleAction] = useState<
    "archive" | "restore" | null
  >(null);
  const [environmentState, setEnvironmentState] = useState<ProjectEnvironmentState>(() =>
    readEnvironmentState(),
  );
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isCreatingProject, setIsCreatingProject] = useState(false);

  const apiBaseUrl = String(apiClient.defaults.baseURL ?? "http://localhost:4000");
  const selectedEnvironmentState =
    selectedProject === null
      ? null
      : (environmentState[selectedProject.id] ?? defaultEnvironmentState());
  const activeProjects = projects.filter((project) => project.status === "active");
  const archivedProjects = projects.filter((project) => project.status === "archived");
  const selectedProjectConfig = useMemo(
    () =>
      selectedProject === null
        ? ""
        : [
            `PULSEOPS_API_BASE_URL=${apiBaseUrl}`,
            `PULSEOPS_PROJECT_ID=${selectedProject.id}`,
            `PULSEOPS_PROJECT_SLUG=${selectedProject.slug}`,
            `PULSEOPS_ENVIRONMENT=${selectedEnvironment}`,
            `PULSEOPS_API_KEY=<raw-api-key>`,
          ].join("\n"),
    [apiBaseUrl, selectedEnvironment, selectedProject],
  );

  async function submitProject(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setError(null);
    setMessage(null);
    setIsCreatingProject(true);

    try {
      const project = await createProject({
        name: projectName,
        description: projectDescription,
        ...(projectSlug.trim().length > 0 ? { slug: projectSlug } : {}),
      });

      setProjectName("");
      setProjectSlug("");
      setProjectDescription("");
      await refreshProjects(project.id);
      setEnvironmentState((current) =>
        writeEnvironmentState(project.id, current, "production", true),
      );
      setMessage("Project created and selected.");
    } catch (requestError) {
      setError(getApiErrorMessage(requestError));
    } finally {
      setIsCreatingProject(false);
    }
  }

  function selectProject(project: Project): void {
    setSelectedProjectId(project.id);
    setEnvironmentState((current) => ensureProjectEnvironmentState(project.id, current));
  }

  function toggleEnvironment(environment: DashboardEnvironment): void {
    if (selectedProject === null) {
      return;
    }

    setEnvironmentState((current) => {
      const currentProject = current[selectedProject.id] ?? defaultEnvironmentState();
      const nextValue = !currentProject[environment];
      const enabledCount = dashboardEnvironments.filter((candidate) =>
        candidate === environment ? nextValue : currentProject[candidate],
      ).length;

      if (enabledCount === 0) {
        setError("At least one standard environment must remain active.");
        return current;
      }

      setError(null);

      if (!nextValue && selectedEnvironment === environment) {
        const replacement =
          dashboardEnvironments.find(
            (candidate) => candidate !== environment && currentProject[candidate],
          ) ?? "production";
        setSelectedEnvironment(replacement);
      }

      return writeEnvironmentState(selectedProject.id, current, environment, nextValue);
    });
  }

  async function copy(value: string, successMessage: string): Promise<void> {
    await navigator.clipboard.writeText(value);
    setMessage(successMessage);
  }

  async function performLifecycleAction(): Promise<void> {
    if (selectedProject === null || pendingLifecycleAction === null) {
      return;
    }

    setError(null);
    setMessage(null);

    try {
      const project =
        pendingLifecycleAction === "archive"
          ? await archiveProject(selectedProject.id)
          : await restoreProject(selectedProject.id);
      await refreshProjects(project.id);
      setMessage(pendingLifecycleAction === "archive" ? "Project archived." : "Project restored.");
    } catch (requestError) {
      setError(getApiErrorMessage(requestError));
    } finally {
      setPendingLifecycleAction(null);
    }
  }

  return (
    <main className="mx-auto flex max-w-7xl flex-col gap-5">
      <header className="flex flex-col gap-3 border-b border-slate-200 pb-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-sm font-medium text-cyan-700">Workspace control</p>
          <h1 className="text-2xl font-semibold tracking-normal">Projects and environments</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
            Create projects, switch ownership context, and keep development, staging, and production
            configuration visible before wiring deployed apps.
          </p>
        </div>
        <Button
          className="w-full sm:w-auto"
          disabled={selectedProject === null}
          onClick={() =>
            selectedProjectConfig.length > 0
              ? void copy(selectedProjectConfig, "Environment config copied.")
              : undefined
          }
          type="button"
          variant="outline"
        >
          <Clipboard className="h-4 w-4" />
          Copy config
        </Button>
      </header>

      {message !== null ? (
        <div className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {message}
        </div>
      ) : null}

      {error !== null ? (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      <section className="grid gap-4 xl:grid-cols-[24rem_1fr]">
        <div className="grid gap-4">
          <form
            className="rounded-md border border-slate-200 bg-white p-4"
            onSubmit={submitProject}
          >
            <div className="flex items-center gap-2">
              <Plus className="h-4 w-4 text-cyan-700" />
              <h2 className="text-sm font-semibold uppercase tracking-normal text-slate-500">
                New project
              </h2>
            </div>
            <div className="mt-4 grid gap-3">
              <label className="text-sm font-medium">
                Project name
                <Input
                  className="mt-2"
                  maxLength={100}
                  onChange={(event) => {
                    const nextName = event.target.value;
                    setProjectName(nextName);
                    setProjectSlug(slugify(nextName));
                  }}
                  placeholder="Checkout API"
                  required
                  value={projectName}
                />
              </label>
              <label className="text-sm font-medium">
                Slug
                <Input
                  className="mt-2"
                  maxLength={80}
                  onChange={(event) => setProjectSlug(event.target.value)}
                  pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
                  placeholder="checkout-api"
                  value={projectSlug}
                />
              </label>
              <label className="text-sm font-medium">
                Description
                <textarea
                  className="mt-2 min-h-24 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm outline-none focus:ring-2 focus:ring-cyan-700"
                  maxLength={500}
                  onChange={(event) => setProjectDescription(event.target.value)}
                  placeholder="What this project owns and which app sends telemetry"
                  value={projectDescription}
                />
              </label>
              <Button disabled={isCreatingProject} type="submit">
                {isCreatingProject ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <FolderKanban className="h-4 w-4" />
                )}
                Create project
              </Button>
            </div>
          </form>

          <section className="rounded-md border border-slate-200 bg-white">
            <div className="border-b border-slate-100 px-4 py-3">
              <div className="flex items-center gap-2">
                <FolderKanban className="h-4 w-4 text-cyan-700" />
                <h2 className="text-sm font-semibold uppercase tracking-normal text-slate-500">
                  Project list
                </h2>
              </div>
            </div>
            {projects.length === 0 ? (
              <p className="px-4 py-6 text-sm text-slate-500">No projects yet.</p>
            ) : (
              <div className="divide-y divide-slate-100">
                {activeProjects.map((project) => (
                  <ProjectRow
                    isSelected={project.id === selectedProject?.id}
                    key={project.id}
                    onSelect={() => selectProject(project)}
                    project={project}
                  />
                ))}
                {archivedProjects.map((project) => (
                  <ProjectRow
                    isSelected={project.id === selectedProject?.id}
                    key={project.id}
                    onSelect={() => selectProject(project)}
                    project={project}
                  />
                ))}
              </div>
            )}
          </section>
        </div>

        <div className="grid gap-4">
          <section className="rounded-md border border-slate-200 bg-white p-4">
            <div className="flex items-center gap-2">
              <Settings className="h-4 w-4 text-cyan-700" />
              <h2 className="text-sm font-semibold uppercase tracking-normal text-slate-500">
                Project details
              </h2>
            </div>

            {selectedProject === null ? (
              <p className="mt-4 text-sm text-slate-500">Create a project to see details.</p>
            ) : (
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                <Detail label="Name" value={selectedProject.name} />
                <Detail label="Status" value={selectedProject.status} />
                <Detail
                  label="Description"
                  value={selectedProject.description ?? "No description"}
                />
                <Detail label="Slug" value={selectedProject.slug} mono />
                <Detail label="Project ID" value={selectedProject.id} mono />
                <Detail label="Created" value={formatRelativeTime(selectedProject.createdAt)} />
                <Detail label="Updated" value={formatRelativeTime(selectedProject.updatedAt)} />
              </div>
            )}

            <div className="mt-4 rounded-md border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">
              Project slugs are immutable after creation in this MVP. Create a new project when a
              production slug has to change.
            </div>

            {selectedProject !== null ? (
              <div className="mt-4 flex flex-col gap-2 rounded-md border border-slate-200 bg-white p-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-semibold text-slate-900">Lifecycle</p>
                  <p className="mt-1 text-xs text-slate-500">
                    Archived projects stay visible for restore and historical telemetry review.
                  </p>
                </div>
                <Button
                  className="w-full sm:w-auto"
                  onClick={() =>
                    setPendingLifecycleAction(
                      selectedProject.status === "active" ? "archive" : "restore",
                    )
                  }
                  type="button"
                  variant={selectedProject.status === "active" ? "outline" : "primary"}
                >
                  {selectedProject.status === "active" ? (
                    <Settings className="h-4 w-4" />
                  ) : (
                    <Undo2 className="h-4 w-4" />
                  )}
                  {selectedProject.status === "active" ? "Archive" : "Restore"}
                </Button>
              </div>
            ) : null}
          </section>

          <section className="rounded-md border border-slate-200 bg-white p-4">
            <div className="flex items-center gap-2">
              <RadioTower className="h-4 w-4 text-cyan-700" />
              <h2 className="text-sm font-semibold uppercase tracking-normal text-slate-500">
                Environment checklist
              </h2>
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              {dashboardEnvironments.map((environment) => {
                const isEnabled = selectedEnvironmentState?.[environment] ?? true;
                const isSelected = selectedEnvironment === environment;

                return (
                  <article
                    className={cn(
                      "rounded-md border p-3",
                      isSelected ? "border-cyan-300 bg-cyan-50" : "border-slate-200 bg-slate-50",
                    )}
                    key={environment}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold capitalize text-slate-900">
                          {environment}
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          {isEnabled ? "Ready for telemetry" : "Needs setup"}
                        </p>
                      </div>
                      {isSelected ? <CheckCircle2 className="h-4 w-4 text-cyan-700" /> : null}
                    </div>
                    <div className="mt-3 grid gap-2">
                      <Button
                        disabled={!isEnabled || selectedProject === null}
                        onClick={() => setSelectedEnvironment(environment)}
                        type="button"
                        variant={isSelected ? "primary" : "outline"}
                      >
                        Select
                      </Button>
                      <Button
                        disabled={selectedProject === null}
                        onClick={() => toggleEnvironment(environment)}
                        type="button"
                        variant="ghost"
                      >
                        {isEnabled ? "Mark not ready" : "Mark ready"}
                      </Button>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>

          <section className="rounded-md border border-slate-200 bg-white p-4">
            <div className="flex items-center gap-2">
              <Terminal className="h-4 w-4 text-cyan-700" />
              <h2 className="text-sm font-semibold uppercase tracking-normal text-slate-500">
                Runtime config
              </h2>
            </div>
            <pre className="mt-4 overflow-x-auto whitespace-pre-wrap break-words rounded-md bg-slate-950 p-3 text-xs leading-5 text-slate-100">
              {selectedProjectConfig.length > 0
                ? selectedProjectConfig
                : "Create a project to generate app environment variables."}
            </pre>
          </section>
        </div>
      </section>

      <ConfirmDialog
        confirmLabel={pendingLifecycleAction === "archive" ? "Archive" : "Restore"}
        description={
          pendingLifecycleAction === "archive"
            ? "The project will be hidden from active operational work but remains restorable."
            : "The project will return to the active project list and selectors."
        }
        isOpen={pendingLifecycleAction !== null}
        onCancel={() => setPendingLifecycleAction(null)}
        onConfirm={() => void performLifecycleAction()}
        title={pendingLifecycleAction === "archive" ? "Archive project?" : "Restore project?"}
      />
    </main>
  );
}

function ProjectRow({
  isSelected,
  onSelect,
  project,
}: {
  readonly isSelected: boolean;
  readonly onSelect: () => void;
  readonly project: Project;
}) {
  return (
    <button
      className={cn(
        "flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition hover:bg-slate-50",
        isSelected && "bg-cyan-50 hover:bg-cyan-50",
      )}
      onClick={onSelect}
      type="button"
    >
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold text-slate-900">{project.name}</p>
        <p className="mt-1 truncate font-mono text-xs text-slate-500">{project.slug}</p>
      </div>
      <div className="flex items-center gap-2">
        <span
          className={cn(
            "rounded-md border px-2 py-1 text-xs font-medium capitalize",
            project.status === "active"
              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
              : "border-slate-200 bg-slate-50 text-slate-600",
          )}
        >
          {project.status}
        </span>
        <ChevronRight className="h-4 w-4 text-slate-400" />
      </div>
    </button>
  );
}

function Detail({
  label,
  mono = false,
  value,
}: {
  readonly label: string;
  readonly mono?: boolean;
  readonly value: string;
}) {
  return (
    <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
      <p className="text-xs font-semibold uppercase tracking-normal text-slate-500">{label}</p>
      <p className={cn("mt-2 break-all text-sm font-semibold text-slate-900", mono && "font-mono")}>
        {value}
      </p>
    </div>
  );
}

function defaultEnvironmentState(): Record<DashboardEnvironment, boolean> {
  return {
    development: true,
    staging: true,
    production: true,
  };
}

function ensureProjectEnvironmentState(
  projectId: string,
  current: ProjectEnvironmentState,
): ProjectEnvironmentState {
  if (current[projectId] !== undefined) {
    return current;
  }

  const next = { ...current, [projectId]: defaultEnvironmentState() };
  localStorage.setItem(environmentsStorageKey, JSON.stringify(next));
  return next;
}

function writeEnvironmentState(
  projectId: string,
  current: ProjectEnvironmentState,
  environment: DashboardEnvironment,
  isEnabled: boolean,
): ProjectEnvironmentState {
  const next = {
    ...current,
    [projectId]: {
      ...(current[projectId] ?? defaultEnvironmentState()),
      [environment]: isEnabled,
    },
  };
  localStorage.setItem(environmentsStorageKey, JSON.stringify(next));
  return next;
}

function readEnvironmentState(): ProjectEnvironmentState {
  const stored = localStorage.getItem(environmentsStorageKey);

  if (stored === null) {
    return {};
  }

  try {
    const parsed = JSON.parse(stored) as ProjectEnvironmentState;
    return parsed;
  } catch {
    localStorage.removeItem(environmentsStorageKey);
    return {};
  }
}

function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}
