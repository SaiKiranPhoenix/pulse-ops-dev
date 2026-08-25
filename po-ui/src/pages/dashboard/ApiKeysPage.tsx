import {
  Clipboard,
  Code2,
  Container,
  KeyRound,
  Loader2,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
  ShieldOff,
  Terminal,
} from "lucide-react";
import { type FormEvent, type ReactNode, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  createApiKey,
  disableApiKey,
  listApiKeys,
  rotateApiKey,
  type ApiKey,
  type CreatedApiKey,
} from "@/features/auth/api";
import { apiClient, getApiErrorMessage } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import { formatRelativeTime } from "./dashboard-utils";
import { useDashboardContext } from "./DashboardLayout";

const scopeOptions = [
  {
    description: "Accept structured application logs.",
    label: "Logs",
    value: "logs:write",
  },
  {
    description: "Accept error events and fingerprints.",
    label: "Errors",
    value: "errors:write",
  },
  {
    description: "Accept metric samples and durations.",
    label: "Metrics",
    value: "metrics:write",
  },
] as const;

type ApiKeyScope = (typeof scopeOptions)[number]["value"];

const defaultScopes: ApiKeyScope[] = ["logs:write", "errors:write", "metrics:write"];

export function ApiKeysPage() {
  const { selectedEnvironment, selectedProject } = useDashboardContext();
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [rawKey, setRawKey] = useState<string | null>(null);
  const [name, setName] = useState("production-ingestion");
  const [selectedScopes, setSelectedScopes] = useState<ApiKeyScope[]>(defaultScopes);
  const [expiresOn, setExpiresOn] = useState("");
  const [pendingDisable, setPendingDisable] = useState<ApiKey | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isMutatingKeyId, setIsMutatingKeyId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const apiBaseUrl = String(apiClient.defaults.baseURL ?? "http://localhost:4000");
  const activeKeys = apiKeys.filter((apiKey) => apiKey.status === "active");
  const disabledKeys = apiKeys.filter((apiKey) => apiKey.status === "disabled");
  const expiringKeys = apiKeys.filter((apiKey) => isExpiringSoon(apiKey.expiresAt));
  const newestActiveKey = activeKeys[0] ?? null;
  const snippetKey = rawKey ?? "<raw-api-key>";

  const snippets = useMemo(
    () => buildConnectionSnippets(apiBaseUrl, selectedEnvironment, snippetKey),
    [apiBaseUrl, selectedEnvironment, snippetKey],
  );

  async function loadApiKeys(): Promise<void> {
    if (selectedProject === null) {
      setApiKeys([]);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const keys = await listApiKeys(selectedProject.id);
      setApiKeys(sortApiKeys(keys));
    } catch (requestError) {
      setError(getApiErrorMessage(requestError));
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    setPendingDisable(null);
    setRawKey(null);
    void loadApiKeys();
  }, [selectedProject?.id]);

  async function submitApiKey(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();

    if (selectedProject === null) {
      setError("Create a project before creating API keys.");
      return;
    }

    if (selectedScopes.length === 0) {
      setError("Choose at least one ingestion scope.");
      return;
    }

    setIsSubmitting(true);
    setError(null);
    setMessage(null);

    try {
      const created = await createApiKey(selectedProject.id, {
        name,
        scopes: selectedScopes,
        ...(expiresOn.length > 0 ? { expiresAt: `${expiresOn}T23:59:59.999Z` } : {}),
      });
      setRawKey(created.rawKey);
      setName("production-ingestion");
      setExpiresOn("");
      setMessage("API key created. Copy the raw key before leaving this page.");
      await loadApiKeys();
    } catch (requestError) {
      setError(getApiErrorMessage(requestError));
    } finally {
      setIsSubmitting(false);
    }
  }

  async function rotate(apiKey: ApiKey): Promise<void> {
    if (selectedProject === null) {
      return;
    }

    setIsMutatingKeyId(apiKey.id);
    await handleRawKeyResponse(
      () => rotateApiKey(selectedProject.id, apiKey.id),
      "API key rotated.",
    );
    setIsMutatingKeyId(null);
  }

  async function confirmDisable(): Promise<void> {
    if (selectedProject === null || pendingDisable === null) {
      return;
    }

    setError(null);
    setMessage(null);
    setIsMutatingKeyId(pendingDisable.id);

    try {
      await disableApiKey(selectedProject.id, pendingDisable.id);
      setMessage("API key disabled.");
      setPendingDisable(null);
      await loadApiKeys();
    } catch (requestError) {
      setError(getApiErrorMessage(requestError));
    } finally {
      setIsMutatingKeyId(null);
    }
  }

  async function handleRawKeyResponse(
    action: () => Promise<CreatedApiKey>,
    successMessage: string,
  ): Promise<void> {
    setError(null);
    setMessage(null);

    try {
      const created = await action();
      setRawKey(created.rawKey);
      setMessage(`${successMessage} Copy the raw key before leaving this page.`);
      await loadApiKeys();
    } catch (requestError) {
      setError(getApiErrorMessage(requestError));
    }
  }

  async function copy(value: string, successMessage = "Copied to clipboard."): Promise<void> {
    await navigator.clipboard.writeText(value);
    setMessage(successMessage);
  }

  function toggleScope(scope: ApiKeyScope): void {
    setSelectedScopes((current) => {
      if (current.includes(scope)) {
        return current.filter((candidate) => candidate !== scope);
      }

      return [...current, scope];
    });
  }

  return (
    <main className="mx-auto flex max-w-7xl flex-col gap-5">
      <header className="flex flex-col gap-3 border-b border-slate-200 pb-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-sm font-medium text-cyan-700">
            {selectedProject?.name ?? "No project selected"} / {selectedEnvironment}
          </p>
          <h1 className="text-2xl font-semibold tracking-normal">Ingestion API keys</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
            Create scoped keys, rotate credentials, disable compromised keys, and copy deployed-app
            connection snippets.
          </p>
        </div>
        <Button
          className="w-auto"
          onClick={() => void loadApiKeys()}
          type="button"
          variant="outline"
        >
          <RefreshCw className="h-4 w-4" />
          Refresh
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

      {rawKey !== null ? (
        <section className="rounded-md border border-amber-200 bg-amber-50 p-4">
          <p className="text-xs font-semibold uppercase tracking-normal text-amber-700">
            Raw key shown once
          </p>
          <div className="mt-2 flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <p className="break-all font-mono text-sm text-amber-950">{rawKey}</p>
            <Button
              className="w-auto"
              onClick={() => void copy(rawKey)}
              type="button"
              variant="outline"
            >
              <Clipboard className="h-4 w-4" />
              Copy
            </Button>
          </div>
        </section>
      ) : null}

      <section className="grid gap-3 md:grid-cols-4">
        <Summary label="Active keys" value={activeKeys.length} />
        <Summary label="Disabled keys" value={disabledKeys.length} />
        <Summary label="Expiring soon" value={expiringKeys.length} />
        <Summary label="Last used" value={newestActiveKey?.lastUsedAt ?? null} />
      </section>

      <section className="grid gap-4 xl:grid-cols-[25rem_1fr]">
        <form className="rounded-md border border-slate-200 bg-white p-4" onSubmit={submitApiKey}>
          <div className="flex items-center gap-2">
            <KeyRound className="h-4 w-4 text-cyan-700" />
            <h2 className="text-sm font-semibold uppercase tracking-normal text-slate-500">
              Create scoped key
            </h2>
          </div>
          <div className="mt-4 grid gap-3">
            <label className="text-sm font-medium">
              Name
              <Input
                className="mt-2"
                maxLength={80}
                onChange={(event) => setName(event.target.value)}
                required
                value={name}
              />
            </label>

            <fieldset className="grid gap-2">
              <legend className="text-sm font-medium">Scopes</legend>
              {scopeOptions.map((scope) => (
                <label
                  className={cn(
                    "flex cursor-pointer items-start gap-3 rounded-md border p-3 transition",
                    selectedScopes.includes(scope.value)
                      ? "border-cyan-300 bg-cyan-50"
                      : "border-slate-200 bg-slate-50",
                  )}
                  key={scope.value}
                >
                  <input
                    checked={selectedScopes.includes(scope.value)}
                    className="mt-1 h-4 w-4 accent-cyan-700"
                    onChange={() => toggleScope(scope.value)}
                    type="checkbox"
                  />
                  <span>
                    <span className="block text-sm font-semibold text-slate-900">
                      {scope.label}
                    </span>
                    <span className="mt-1 block text-xs text-slate-500">{scope.description}</span>
                  </span>
                </label>
              ))}
            </fieldset>

            <label className="text-sm font-medium">
              Expires on
              <Input
                className="mt-2"
                min={new Date().toISOString().slice(0, 10)}
                onChange={(event) => setExpiresOn(event.target.value)}
                type="date"
                value={expiresOn}
              />
            </label>

            <Button disabled={isSubmitting || selectedProject === null} type="submit">
              {isSubmitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <KeyRound className="h-4 w-4" />
              )}
              Create API key
            </Button>
          </div>
        </form>

        <section className="overflow-x-auto rounded-md border border-slate-200 bg-white">
          <div className="grid min-w-[58rem] grid-cols-[1fr_7rem_8rem_8rem_9rem_8rem] gap-3 border-b border-slate-100 px-4 py-3 text-xs font-semibold uppercase tracking-normal text-slate-500">
            <span>Key</span>
            <span>Status</span>
            <span>Scopes</span>
            <span>Expires</span>
            <span>Last used</span>
            <span className="text-right">Actions</span>
          </div>
          {apiKeys.length === 0 ? (
            <p className="px-4 py-6 text-sm text-slate-500">
              {isLoading ? "Loading keys" : "No API keys yet"}
            </p>
          ) : (
            <div className="min-w-[58rem] divide-y divide-slate-100">
              {apiKeys.map((apiKey) => (
                <article
                  className="grid grid-cols-[1fr_7rem_8rem_8rem_9rem_8rem] items-center gap-3 px-4 py-3"
                  key={apiKey.id}
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-900">{apiKey.name}</p>
                    <p className="mt-1 truncate font-mono text-xs text-slate-500">
                      {apiKey.keyPrefix} / created {formatRelativeTime(apiKey.createdAt)}
                    </p>
                  </div>
                  <span
                    className={cn(
                      "w-fit rounded-md border px-2 py-1 text-xs font-medium capitalize",
                      apiKey.status === "active"
                        ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                        : "border-slate-200 bg-slate-50 text-slate-600",
                    )}
                  >
                    {apiKey.status}
                  </span>
                  <span className="text-sm text-slate-600">{apiKey.scopes.length}</span>
                  <span className="text-sm text-slate-600">
                    {formatOptionalDate(apiKey.expiresAt)}
                  </span>
                  <span className="text-sm text-slate-600">
                    {apiKey.lastUsedAt === null ? "Never" : formatRelativeTime(apiKey.lastUsedAt)}
                  </span>
                  <div className="flex justify-end gap-2">
                    <Button
                      className="h-9 w-9 px-0"
                      disabled={apiKey.status !== "active" || isMutatingKeyId === apiKey.id}
                      onClick={() => void rotate(apiKey)}
                      title="Rotate key"
                      type="button"
                      variant="outline"
                    >
                      {isMutatingKeyId === apiKey.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <RotateCcw className="h-4 w-4" />
                      )}
                    </Button>
                    <Button
                      className="h-9 w-9 px-0"
                      disabled={apiKey.status !== "active" || isMutatingKeyId === apiKey.id}
                      onClick={() => setPendingDisable(apiKey)}
                      title="Disable key"
                      type="button"
                      variant="outline"
                    >
                      <ShieldOff className="h-4 w-4" />
                    </Button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </section>

      {pendingDisable !== null ? (
        <section className="rounded-md border border-red-200 bg-red-50 p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-sm font-semibold text-red-900">Disable {pendingDisable.name}</p>
              <p className="mt-1 text-sm text-red-700">
                Deployed apps using prefix {pendingDisable.keyPrefix} will stop sending telemetry.
              </p>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button
                className="w-auto"
                onClick={() => setPendingDisable(null)}
                type="button"
                variant="outline"
              >
                Cancel
              </Button>
              <Button
                className="w-auto bg-red-700 text-white hover:bg-red-800"
                disabled={isMutatingKeyId === pendingDisable.id}
                onClick={() => void confirmDisable()}
                type="button"
              >
                {isMutatingKeyId === pendingDisable.id ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <ShieldOff className="h-4 w-4" />
                )}
                Disable key
              </Button>
            </div>
          </div>
        </section>
      ) : null}

      <section className="grid gap-4 xl:grid-cols-[1fr_23rem]">
        <div className="rounded-md border border-slate-200 bg-white p-4">
          <div className="flex items-center gap-2">
            <Terminal className="h-4 w-4 text-cyan-700" />
            <h2 className="text-sm font-semibold uppercase tracking-normal text-slate-500">
              Deployed app setup
            </h2>
          </div>
          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <Snippet
              icon={<Code2 className="h-4 w-4" />}
              onCopy={copy}
              title="Environment"
              value={snippets.env}
            />
            <Snippet
              icon={<Terminal className="h-4 w-4" />}
              onCopy={copy}
              title="Node fetch"
              value={snippets.node}
            />
            <Snippet
              icon={<Terminal className="h-4 w-4" />}
              onCopy={copy}
              title="cURL metric"
              value={snippets.curl}
            />
            <Snippet
              icon={<Container className="h-4 w-4" />}
              onCopy={copy}
              title="Docker env"
              value={snippets.docker}
            />
          </div>
        </div>

        <aside className="rounded-md border border-slate-200 bg-white p-4">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-cyan-700" />
            <h2 className="text-sm font-semibold uppercase tracking-normal text-slate-500">
              Agentless config
            </h2>
          </div>
          <pre className="mt-4 overflow-x-auto whitespace-pre-wrap break-words rounded-md bg-slate-950 p-3 text-xs leading-5 text-slate-100">
            {snippets.agent}
          </pre>
          <Button
            className="mt-3"
            onClick={() => void copy(snippets.agent, "Agentless config copied.")}
            type="button"
            variant="outline"
          >
            <Clipboard className="h-4 w-4" />
            Copy config
          </Button>
        </aside>
      </section>
    </main>
  );
}

function Summary({
  label,
  value,
}: {
  readonly label: string;
  readonly value: number | string | null;
}) {
  return (
    <div className="rounded-md border border-slate-200 bg-white p-4">
      <p className="text-sm font-medium text-slate-500">{label}</p>
      <p className="mt-3 text-2xl font-semibold tabular-nums text-slate-950">
        {typeof value === "string" ? formatRelativeTime(value) : (value ?? "Never")}
      </p>
    </div>
  );
}

function Snippet({
  icon,
  onCopy,
  title,
  value,
}: {
  readonly icon: ReactNode;
  readonly onCopy: (value: string, successMessage?: string) => Promise<void>;
  readonly title: string;
  readonly value: string;
}) {
  return (
    <div className="min-w-0 rounded-md border border-slate-200 bg-slate-950 p-3 text-white">
      <div className="mb-2 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-slate-300">
          {icon}
          <p className="text-xs font-semibold uppercase tracking-normal">{title}</p>
        </div>
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

function buildConnectionSnippets(
  apiBaseUrl: string,
  environment: string,
  apiKey: string,
): {
  readonly agent: string;
  readonly curl: string;
  readonly docker: string;
  readonly env: string;
  readonly node: string;
} {
  const env = [
    `PULSEOPS_API_BASE_URL=${apiBaseUrl}`,
    `PULSEOPS_API_KEY=${apiKey}`,
    `PULSEOPS_SERVICE_NAME=checkout-api`,
    `PULSEOPS_ENVIRONMENT=${environment}`,
  ].join("\n");

  const node = [
    `await fetch("${apiBaseUrl}/ingest/logs", {`,
    `  method: "POST",`,
    `  headers: {`,
    `    "content-type": "application/json",`,
    `    "x-api-key": process.env.PULSEOPS_API_KEY ?? "",`,
    `  },`,
    `  body: JSON.stringify({`,
    `    source: process.env.PULSEOPS_SERVICE_NAME ?? "checkout-api",`,
    `    level: "info",`,
    `    message: "Order accepted",`,
    `    attributes: { environment: "${environment}", region: "us-east-1" },`,
    `  }),`,
    `});`,
  ].join("\n");

  const curl = [
    `curl -X POST ${apiBaseUrl}/ingest/metrics \\`,
    `  -H "content-type: application/json" \\`,
    `  -H "x-api-key: ${apiKey}" \\`,
    `  -d "{\\"source\\":\\"checkout-api\\",\\"name\\":\\"checkout.latency\\",\\"value\\":238,\\"unit\\":\\"ms\\",\\"attributes\\":{\\"environment\\":\\"${environment}\\"}}"`,
  ].join("\n");

  const docker = [
    `docker run --rm \\`,
    `  -e PULSEOPS_API_BASE_URL=${apiBaseUrl} \\`,
    `  -e PULSEOPS_API_KEY=${apiKey} \\`,
    `  -e PULSEOPS_SERVICE_NAME=checkout-api \\`,
    `  -e PULSEOPS_ENVIRONMENT=${environment} \\`,
    `  your-image:latest`,
  ].join("\n");

  const agent = [
    `pulseops:`,
    `  intake: ${apiBaseUrl}`,
    `  apiKey: ${apiKey}`,
    `  service: checkout-api`,
    `  environment: ${environment}`,
    `  scopes: logs:write, errors:write, metrics:write`,
  ].join("\n");

  return { agent, curl, docker, env, node };
}

function sortApiKeys(apiKeys: ApiKey[]): ApiKey[] {
  return [...apiKeys].sort(
    (left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt),
  );
}

function formatOptionalDate(value: string | null): string {
  if (value === null) {
    return "Never";
  }

  return new Intl.DateTimeFormat(undefined, {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

function isExpiringSoon(value: string | null): boolean {
  if (value === null) {
    return false;
  }

  const expiresAt = Date.parse(value);
  const thirtyDaysMs = 30 * 24 * 60 * 60 * 1_000;
  return expiresAt > Date.now() && expiresAt - Date.now() <= thirtyDaysMs;
}
