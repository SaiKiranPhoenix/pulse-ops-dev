import { Clipboard, KeyRound, Loader2, RefreshCw, RotateCcw, ShieldOff } from "lucide-react";
import { type FormEvent, useEffect, useState } from "react";
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
import { getApiErrorMessage } from "@/lib/api-client";
import { formatRelativeTime } from "./dashboard-utils";
import { useDashboardContext } from "./DashboardLayout";

const defaultScopes = ["logs:write", "errors:write", "metrics:write"] as const;

export function ApiKeysPage() {
  const { selectedProject } = useDashboardContext();
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [rawKey, setRawKey] = useState<string | null>(null);
  const [name, setName] = useState("local-ingestion");
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function loadApiKeys(): Promise<void> {
    if (selectedProject === null) {
      setApiKeys([]);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      setApiKeys(await listApiKeys(selectedProject.id));
    } catch (requestError) {
      setError(getApiErrorMessage(requestError));
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadApiKeys();
  }, [selectedProject?.id]);

  async function submitApiKey(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();

    if (selectedProject === null) {
      setError("Create a project before creating API keys.");
      return;
    }

    setIsSubmitting(true);
    setError(null);
    setMessage(null);

    try {
      const created = await createApiKey(selectedProject.id, {
        name,
        scopes: [...defaultScopes],
      });
      setRawKey(created.rawKey);
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

    await handleRawKeyResponse(
      () => rotateApiKey(selectedProject.id, apiKey.id),
      "API key rotated.",
    );
  }

  async function disable(apiKey: ApiKey): Promise<void> {
    if (selectedProject === null) {
      return;
    }

    setError(null);
    setMessage(null);

    try {
      await disableApiKey(selectedProject.id, apiKey.id);
      setMessage("API key disabled.");
      await loadApiKeys();
    } catch (requestError) {
      setError(getApiErrorMessage(requestError));
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

  async function copyRawKey(): Promise<void> {
    if (rawKey === null) {
      return;
    }

    await navigator.clipboard.writeText(rawKey);
    setMessage("Copied to clipboard.");
  }

  return (
    <main className="mx-auto flex max-w-7xl flex-col gap-5">
      <header className="flex flex-col gap-3 border-b border-slate-200 pb-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-sm font-medium text-cyan-700">
            {selectedProject?.name ?? "No project selected"}
          </p>
          <h1 className="text-2xl font-semibold tracking-normal">Ingestion API keys</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
            Create, rotate, and disable keys used by deployed applications to send telemetry into
            PulseOps.
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
              onClick={() => void copyRawKey()}
              type="button"
              variant="outline"
            >
              <Clipboard className="h-4 w-4" />
              Copy
            </Button>
          </div>
        </section>
      ) : null}

      <section className="grid gap-4 xl:grid-cols-[24rem_1fr]">
        <form className="rounded-md border border-slate-200 bg-white p-4" onSubmit={submitApiKey}>
          <div className="flex items-center gap-2">
            <KeyRound className="h-4 w-4 text-cyan-700" />
            <h2 className="text-sm font-semibold uppercase tracking-normal text-slate-500">
              Create key
            </h2>
          </div>
          <div className="mt-4 grid gap-3">
            <label className="text-sm font-medium">
              Name
              <Input
                className="mt-2"
                maxLength={80}
                onChange={(event) => {
                  setName(event.target.value);
                }}
                required
                value={name}
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

        <section className="rounded-md border border-slate-200 bg-white">
          <div className="grid grid-cols-[1fr_7rem_9rem_8rem] gap-3 border-b border-slate-100 px-4 py-3 text-xs font-semibold uppercase tracking-normal text-slate-500">
            <span>Key</span>
            <span>Status</span>
            <span>Last used</span>
            <span className="text-right">Actions</span>
          </div>
          {apiKeys.length === 0 ? (
            <p className="px-4 py-6 text-sm text-slate-500">
              {isLoading ? "Loading keys" : "No API keys yet"}
            </p>
          ) : (
            <div className="divide-y divide-slate-100">
              {apiKeys.map((apiKey) => (
                <article
                  className="grid grid-cols-[1fr_7rem_9rem_8rem] items-center gap-3 px-4 py-3"
                  key={apiKey.id}
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-900">{apiKey.name}</p>
                    <p className="mt-1 truncate font-mono text-xs text-slate-500">
                      {apiKey.keyPrefix} - {apiKey.scopes.join(", ")}
                    </p>
                  </div>
                  <span className="text-sm capitalize text-slate-600">{apiKey.status}</span>
                  <span className="text-sm text-slate-600">
                    {apiKey.lastUsedAt === null ? "Never" : formatRelativeTime(apiKey.lastUsedAt)}
                  </span>
                  <div className="flex justify-end gap-2">
                    <Button
                      className="h-9 w-9 px-0"
                      disabled={apiKey.status !== "active"}
                      onClick={() => void rotate(apiKey)}
                      type="button"
                      variant="outline"
                    >
                      <RotateCcw className="h-4 w-4" />
                    </Button>
                    <Button
                      className="h-9 w-9 px-0"
                      disabled={apiKey.status !== "active"}
                      onClick={() => void disable(apiKey)}
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
    </main>
  );
}
