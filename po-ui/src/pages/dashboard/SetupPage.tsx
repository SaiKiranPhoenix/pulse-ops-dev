import {
  CheckCircle2,
  Clipboard,
  KeyRound,
  Loader2,
  RadioTower,
  Send,
  Terminal,
} from "lucide-react";
import { type FormEvent, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createApiKey, createProject, type CreatedApiKey, type Project } from "@/features/auth/api";
import {
  ingestError,
  ingestLog,
  ingestMetric,
  type IngestedEventAck,
} from "@/features/ingestion/api";
import { apiClient, getApiErrorMessage } from "@/lib/api-client";
import { useDashboardContext } from "./DashboardLayout";

const defaultScopes = ["logs:write", "errors:write", "metrics:write"] as const;

export function SetupPage() {
  const { projects, refreshProjects, selectedEnvironment, selectedProject } = useDashboardContext();
  const [projectName, setProjectName] = useState(projects.length === 0 ? "Production API" : "");
  const [projectSlug, setProjectSlug] = useState(projects.length === 0 ? "production-api" : "");
  const [keyName, setKeyName] = useState("local-ingestion");
  const [createdProject, setCreatedProject] = useState<Project | null>(null);
  const [createdKey, setCreatedKey] = useState<CreatedApiKey | null>(null);
  const [lastAck, setLastAck] = useState<IngestedEventAck | null>(null);
  const [isCreatingProject, setIsCreatingProject] = useState(false);
  const [isCreatingKey, setIsCreatingKey] = useState(false);
  const [isSendingTest, setIsSendingTest] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const targetProject = createdProject ?? selectedProject;
  const apiBaseUrl = String(apiClient.defaults.baseURL ?? "http://localhost:4000");

  const curlSnippet = useMemo(() => {
    const apiKey = createdKey?.rawKey ?? "<raw-api-key>";

    return [
      `curl -X POST ${apiBaseUrl}/ingest/logs \\`,
      `  -H "content-type: application/json" \\`,
      `  -H "x-api-key: ${apiKey}" \\`,
      `  -d "{\\"source\\":\\"checkout-api\\",\\"level\\":\\"info\\",\\"message\\":\\"PulseOps connected\\",\\"attributes\\":{\\"environment\\":\\"${selectedEnvironment}\\"}}"`,
    ].join("\n");
  }, [apiBaseUrl, createdKey?.rawKey, selectedEnvironment]);

  const nodeSnippet = useMemo(() => {
    const apiKey = createdKey?.rawKey ?? "process.env.PULSEOPS_API_KEY";

    return [
      `await fetch("${apiBaseUrl}/ingest/errors", {`,
      `  method: "POST",`,
      `  headers: {`,
      `    "content-type": "application/json",`,
      `    "x-api-key": "${apiKey}",`,
      `  },`,
      `  body: JSON.stringify({`,
      `    source: "checkout-api",`,
      `    name: "CheckoutError",`,
      `    message: "Payment provider timeout",`,
      `    attributes: { environment: "${selectedEnvironment}" },`,
      `  }),`,
      `});`,
    ].join("\n");
  }, [apiBaseUrl, createdKey?.rawKey, selectedEnvironment]);

  async function submitProject(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setError(null);
    setMessage(null);
    setIsCreatingProject(true);

    try {
      const project = await createProject({
        name: projectName,
        ...(projectSlug.trim().length > 0 ? { slug: projectSlug } : {}),
      });
      setCreatedProject(project);
      await refreshProjects(project.id);
      setMessage("Project created. Generate an ingestion key next.");
    } catch (requestError) {
      setError(getApiErrorMessage(requestError));
    } finally {
      setIsCreatingProject(false);
    }
  }

  async function submitApiKey(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();

    if (targetProject === null) {
      setError("Create or select a project first.");
      return;
    }

    setError(null);
    setMessage(null);
    setIsCreatingKey(true);

    try {
      const apiKey = await createApiKey(targetProject.id, {
        name: keyName,
        scopes: [...defaultScopes],
      });
      setCreatedKey(apiKey);
      setMessage("API key created. Copy it now; the raw key is shown only once.");
    } catch (requestError) {
      setError(getApiErrorMessage(requestError));
    } finally {
      setIsCreatingKey(false);
    }
  }

  async function sendTestTraffic(kind: "log" | "error" | "metric"): Promise<void> {
    if (createdKey === null) {
      setError("Generate an ingestion API key before sending test telemetry.");
      return;
    }

    setError(null);
    setMessage(null);
    setIsSendingTest(true);

    try {
      const headers = {
        apiKey: createdKey.rawKey,
        idempotencyKey: `setup-${kind}-${crypto.randomUUID()}`,
      };
      const ack =
        kind === "log"
          ? await ingestLog(headers, {
              source: "setup-wizard",
              level: "info",
              message: "PulseOps setup test log",
              attributes: { environment: selectedEnvironment },
            })
          : kind === "error"
            ? await ingestError(headers, {
                source: "setup-wizard",
                name: "SetupError",
                message: "PulseOps setup test error",
                attributes: { environment: selectedEnvironment },
              })
            : await ingestMetric(headers, {
                source: "setup-wizard",
                name: "setup.latency",
                value: 245,
                unit: "ms",
                attributes: { environment: selectedEnvironment },
              });

      setLastAck(ack);
      setMessage(`${kind} event accepted. Open Overview or Logs to watch processing.`);
    } catch (requestError) {
      setError(getApiErrorMessage(requestError));
    } finally {
      setIsSendingTest(false);
    }
  }

  async function copy(value: string): Promise<void> {
    await navigator.clipboard.writeText(value);
    setMessage("Copied to clipboard.");
  }

  return (
    <main className="mx-auto flex max-w-7xl flex-col gap-5">
      <header className="border-b border-slate-200 pb-4">
        <p className="text-sm font-medium text-cyan-700">Workspace setup</p>
        <h1 className="text-2xl font-semibold tracking-normal">Connect your first application</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
          Create a project, generate an ingestion key, send test telemetry, and then wire the same
          endpoint into a deployed application.
        </p>
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

      <section className="grid gap-4 xl:grid-cols-[26rem_1fr]">
        <form className="rounded-md border border-slate-200 bg-white p-4" onSubmit={submitProject}>
          <div className="flex items-center gap-2">
            <RadioTower className="h-4 w-4 text-cyan-700" />
            <h2 className="text-sm font-semibold uppercase tracking-normal text-slate-500">
              1. Project
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
                required
                value={projectName}
              />
            </label>
            <label className="text-sm font-medium">
              Slug
              <Input
                className="mt-2"
                maxLength={80}
                onChange={(event) => {
                  setProjectSlug(event.target.value);
                }}
                pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
                value={projectSlug}
              />
            </label>
            <Button disabled={isCreatingProject} type="submit">
              {isCreatingProject ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <CheckCircle2 className="h-4 w-4" />
              )}
              Create project
            </Button>
          </div>
          {targetProject !== null ? (
            <p className="mt-3 text-xs text-slate-500">
              Current project:{" "}
              <span className="font-medium text-slate-900">{targetProject.name}</span>
            </p>
          ) : null}
        </form>

        <form className="rounded-md border border-slate-200 bg-white p-4" onSubmit={submitApiKey}>
          <div className="flex items-center gap-2">
            <KeyRound className="h-4 w-4 text-cyan-700" />
            <h2 className="text-sm font-semibold uppercase tracking-normal text-slate-500">
              2. Ingestion API Key
            </h2>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-[1fr_auto]">
            <label className="text-sm font-medium">
              Key name
              <Input
                className="mt-2"
                maxLength={80}
                onChange={(event) => {
                  setKeyName(event.target.value);
                }}
                required
                value={keyName}
              />
            </label>
            <Button
              className="self-end md:w-auto"
              disabled={isCreatingKey || targetProject === null}
              type="submit"
            >
              {isCreatingKey ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <KeyRound className="h-4 w-4" />
              )}
              Generate key
            </Button>
          </div>

          {createdKey !== null ? (
            <div className="mt-4 rounded-md border border-amber-200 bg-amber-50 p-3">
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div className="min-w-0">
                  <p className="text-xs font-semibold uppercase tracking-normal text-amber-700">
                    Raw key shown once
                  </p>
                  <p className="mt-2 break-all font-mono text-sm text-amber-950">
                    {createdKey.rawKey}
                  </p>
                </div>
                <Button
                  className="w-auto"
                  onClick={() => void copy(createdKey.rawKey)}
                  type="button"
                  variant="outline"
                >
                  <Clipboard className="h-4 w-4" />
                  Copy
                </Button>
              </div>
            </div>
          ) : null}
        </form>
      </section>

      <section className="grid gap-4 xl:grid-cols-[1fr_24rem]">
        <div className="rounded-md border border-slate-200 bg-white p-4">
          <div className="flex items-center gap-2">
            <Terminal className="h-4 w-4 text-cyan-700" />
            <h2 className="text-sm font-semibold uppercase tracking-normal text-slate-500">
              3. App Connection
            </h2>
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <Snippet title="cURL log event" value={curlSnippet} onCopy={copy} />
            <Snippet title="Node error event" value={nodeSnippet} onCopy={copy} />
          </div>
        </div>

        <div className="rounded-md border border-slate-200 bg-white p-4">
          <div className="flex items-center gap-2">
            <Send className="h-4 w-4 text-cyan-700" />
            <h2 className="text-sm font-semibold uppercase tracking-normal text-slate-500">
              4. Test Telemetry
            </h2>
          </div>
          <div className="mt-4 grid gap-2">
            <Button
              disabled={createdKey === null || isSendingTest}
              onClick={() => void sendTestTraffic("log")}
              type="button"
              variant="outline"
            >
              Send test log
            </Button>
            <Button
              disabled={createdKey === null || isSendingTest}
              onClick={() => void sendTestTraffic("error")}
              type="button"
              variant="outline"
            >
              Send test error
            </Button>
            <Button
              disabled={createdKey === null || isSendingTest}
              onClick={() => void sendTestTraffic("metric")}
              type="button"
              variant="outline"
            >
              Send test metric
            </Button>
          </div>

          {lastAck !== null ? (
            <div className="mt-4 rounded-md border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
              <p className="font-medium text-slate-900">Accepted {lastAck.type}</p>
              <p className="mt-1 break-all font-mono">{lastAck.id}</p>
            </div>
          ) : null}

          <Button asChild className="mt-4" variant="primary">
            <Link to="/dashboard">Open overview</Link>
          </Button>
        </div>
      </section>
    </main>
  );
}

function Snippet({
  onCopy,
  title,
  value,
}: {
  readonly onCopy: (value: string) => Promise<void>;
  readonly title: string;
  readonly value: string;
}) {
  return (
    <div className="min-w-0 rounded-md border border-slate-200 bg-slate-950 p-3 text-white">
      <div className="mb-2 flex items-center justify-between gap-3">
        <p className="text-xs font-semibold uppercase tracking-normal text-slate-300">{title}</p>
        <Button
          className="h-8 w-8 px-0 text-slate-950"
          onClick={() => void onCopy(value)}
          type="button"
          variant="secondary"
        >
          <Clipboard className="h-4 w-4" />
        </Button>
      </div>
      <pre className="overflow-x-auto whitespace-pre-wrap break-words text-xs leading-5 text-slate-100">
        {value}
      </pre>
    </div>
  );
}

function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}
