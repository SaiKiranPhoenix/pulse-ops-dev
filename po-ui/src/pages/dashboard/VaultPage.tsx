import {
  Clipboard,
  Eye,
  EyeOff,
  KeyRound,
  LockKeyhole,
  RefreshCw,
  RotateCcw,
  Save,
  ShieldCheck,
  Trash2,
} from "lucide-react";
import { type FormEvent, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Input } from "@/components/ui/input";
import {
  createSecret,
  createVaultToken,
  deleteSecret,
  fetchSecretWithIntegrationToken,
  getVaultTokenCacheDiagnostics,
  listSecrets,
  listSecretVersions,
  listVaultAuditEvents,
  listVaultTokens,
  revealSecret,
  revokeVaultToken,
  updateSecret,
  type RevealedVaultSecret,
  type VaultAuditEvent,
  type VaultSecretMetadata,
  type VaultSecretVersion,
  type VaultToken,
  type VaultTokenCacheDiagnostics,
} from "@/features/vault/api";
import { getApiErrorMessage } from "@/lib/api-client";
import {
  createPulseOpsSocket,
  joinProjectRoom,
  leaveProjectRoom,
  type RealtimeVaultAuditCreated,
} from "@/lib/socket-client";
import { formatRelativeTime } from "./dashboard-utils";
import {
  dashboardEnvironments,
  useDashboardContext,
  type DashboardEnvironment,
} from "./DashboardLayout";

const defaultTokenScope = "secrets:read";
const tokenScopeOptions = ["secrets:read", "secrets:list"] as const;

type SecretForm = {
  readonly environment: DashboardEnvironment;
  readonly key: string;
  readonly value: string;
};

export function VaultPage() {
  const { selectedEnvironment, selectedProject, setSelectedEnvironment } = useDashboardContext();
  const [secrets, setSecrets] = useState<VaultSecretMetadata[]>([]);
  const [tokens, setTokens] = useState<VaultToken[]>([]);
  const [tokenCacheDiagnostics, setTokenCacheDiagnostics] =
    useState<VaultTokenCacheDiagnostics | null>(null);
  const [auditEvents, setAuditEvents] = useState<VaultAuditEvent[]>([]);
  const [activeSecret, setActiveSecret] = useState<VaultSecretMetadata | null>(null);
  const [activeSecretVersions, setActiveSecretVersions] = useState<VaultSecretVersion[]>([]);
  const [pendingDeleteSecret, setPendingDeleteSecret] = useState<VaultSecretMetadata | null>(null);
  const [revealedSecret, setRevealedSecret] = useState<RevealedVaultSecret | null>(null);
  const [rawToken, setRawToken] = useState<string | null>(null);
  const [integrationFetch, setIntegrationFetch] = useState<RevealedVaultSecret | null>(null);
  const [secretForm, setSecretForm] = useState<SecretForm>({
    environment: selectedEnvironment,
    key: "",
    value: "",
  });
  const [vaultPassword, setVaultPassword] = useState("");
  const [unlockForm, setUnlockForm] = useState({ password: "", confirmPassword: "" });
  const [vaultPasswordSession, setVaultPasswordSession] = useState<string | null>(null);
  const [tokenForm, setTokenForm] = useState({
    name: "production-reader",
    environment: selectedEnvironment,
    scopes: [defaultTokenScope],
    expiresAt: "",
  });
  const [fetchForm, setFetchForm] = useState({
    token: "",
    environment: selectedEnvironment,
    key: "",
  });
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function loadVault(): Promise<void> {
    if (selectedProject === null) {
      setSecrets([]);
      setTokens([]);
      setTokenCacheDiagnostics(null);
      setAuditEvents([]);
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    try {
      const [secretList, tokenList, tokenCache, events] = await Promise.all([
        listSecrets(selectedProject.id, selectedEnvironment),
        listVaultTokens(selectedProject.id),
        getVaultTokenCacheDiagnostics(selectedProject.id),
        listVaultAuditEvents(selectedProject.id),
      ]);
      setSecrets(secretList);
      setTokens(tokenList);
      setTokenCacheDiagnostics(tokenCache);
      setAuditEvents(events);
    } catch (requestError) {
      setErrorMessage(getApiErrorMessage(requestError));
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    setSecretForm((current) => ({ ...current, environment: selectedEnvironment }));
    setTokenForm((current) => ({ ...current, environment: selectedEnvironment }));
    setFetchForm((current) => ({ ...current, environment: selectedEnvironment }));
    setRevealedSecret(null);
    setActiveSecret(null);
    void loadVault();
  }, [selectedProject?.id, selectedEnvironment]);

  useEffect(() => {
    if (selectedProject === null) {
      return;
    }

    const socket = createPulseOpsSocket();

    if (socket === null) {
      return;
    }

    socket.on("connect", () => {
      void joinProjectRoom(socket, selectedProject.id, selectedEnvironment);
    });
    socket.on("vault.audit.created", (update: RealtimeVaultAuditCreated) => {
      setAuditEvents((current) => upsertAuditEvent(current, update.auditEvent).slice(0, 100));
    });
    socket.connect();

    return () => {
      leaveProjectRoom(socket, selectedProject.id, selectedEnvironment);
      socket.disconnect();
    };
  }, [selectedEnvironment, selectedProject]);

  useEffect(() => {
    if (activeSecret === null) {
      setActiveSecretVersions([]);
      return;
    }

    const selectedSecret = activeSecret;

    async function loadVersions(): Promise<void> {
      try {
        setActiveSecretVersions(
          await listSecretVersions(
            selectedSecret.projectId,
            selectedSecret.environment,
            selectedSecret.key,
          ),
        );
      } catch {
        setActiveSecretVersions([]);
      }
    }

    void loadVersions();
  }, [activeSecret]);

  const vaultSummary = useMemo(
    () => ({
      secrets: secrets.length,
      tokens: tokens.filter((token) => token.status === "active").length,
      tokenCache: tokenCacheDiagnostics?.status ?? "unknown",
      reveals: auditEvents.filter((event) => event.action === "vault.secret.reveal").length,
      failures: auditEvents.filter((event) => event.result === "failure").length,
    }),
    [auditEvents, secrets.length, tokenCacheDiagnostics?.status, tokens],
  );

  async function submitSecret(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();

    if (selectedProject === null) {
      setErrorMessage("Create a project before storing secrets.");
      return;
    }

    setMessage(null);
    setErrorMessage(null);

    try {
      await createSecret({
        projectId: selectedProject.id,
        environment: secretForm.environment,
        key: secretForm.key,
        value: secretForm.value,
      });
      setSecretForm((current) => ({ ...current, key: "", value: "" }));
      setMessage("Secret stored encrypted.");
      await loadVault();
    } catch (requestError) {
      setErrorMessage(getApiErrorMessage(requestError));
    }
  }

  async function rotateSecret(secret: VaultSecretMetadata): Promise<void> {
    if (secretForm.value.length === 0) {
      setErrorMessage("Enter a new secret value before rotating.");
      return;
    }

    setMessage(null);
    setErrorMessage(null);

    try {
      await updateSecret({
        projectId: secret.projectId,
        environment: secret.environment,
        key: secret.key,
        value: secretForm.value,
      });
      setSecretForm((current) => ({ ...current, value: "" }));
      setMessage("Secret rotated.");
      await loadVault();
    } catch (requestError) {
      setErrorMessage(getApiErrorMessage(requestError));
    }
  }

  async function revealActiveSecret(): Promise<void> {
    if (activeSecret === null) {
      return;
    }

    const password = vaultPassword.length > 0 ? vaultPassword : (vaultPasswordSession ?? "");

    if (password.length === 0) {
      setErrorMessage("Vault password is required to reveal secrets.");
      return;
    }

    setMessage(null);
    setErrorMessage(null);

    try {
      setRevealedSecret(
        await revealSecret(
          activeSecret.projectId,
          activeSecret.environment,
          activeSecret.key,
          password,
        ),
      );
      await loadVault();
    } catch (requestError) {
      setErrorMessage(getApiErrorMessage(requestError));
    }
  }

  async function remove(secret: VaultSecretMetadata): Promise<void> {
    setMessage(null);
    setErrorMessage(null);

    try {
      await deleteSecret(secret.projectId, secret.environment, secret.key);
      setMessage("Secret deleted.");
      await loadVault();
      setPendingDeleteSecret(null);
    } catch (requestError) {
      setErrorMessage(getApiErrorMessage(requestError));
    }
  }

  async function createToken(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();

    if (selectedProject === null) {
      setErrorMessage("Create a project before creating vault tokens.");
      return;
    }

    setMessage(null);
    setErrorMessage(null);

    try {
      const created = await createVaultToken({
        projectId: selectedProject.id,
        name: tokenForm.name,
        scopes: tokenForm.scopes,
        environments: [tokenForm.environment],
        expiresAt:
          tokenForm.expiresAt.trim().length === 0
            ? null
            : new Date(tokenForm.expiresAt).toISOString(),
      });
      setRawToken(created.rawToken);
      setFetchForm((current) => ({ ...current, token: created.rawToken }));
      setMessage("Vault integration token created. Copy it now; the raw token is shown once.");
      await loadVault();
    } catch (requestError) {
      setErrorMessage(getApiErrorMessage(requestError));
    }
  }

  async function revokeToken(token: VaultToken): Promise<void> {
    setMessage(null);
    setErrorMessage(null);

    try {
      await revokeVaultToken(token.projectId, token.id);
      setMessage("Vault token revoked.");
      await loadVault();
    } catch (requestError) {
      setErrorMessage(getApiErrorMessage(requestError));
    }
  }

  async function testIntegrationFetch(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setMessage(null);
    setErrorMessage(null);
    setIntegrationFetch(null);

    try {
      const secret = await fetchSecretWithIntegrationToken(
        fetchForm.environment,
        fetchForm.key,
        fetchForm.token,
      );
      setIntegrationFetch(secret);
      setMessage("Integration token fetched the secret successfully.");
      await loadVault();
    } catch (requestError) {
      setErrorMessage(getApiErrorMessage(requestError));
    }
  }

  async function copy(value: string): Promise<void> {
    await navigator.clipboard.writeText(value);
    setMessage("Copied to clipboard.");
  }

  function closeReveal(): void {
    setRevealedSecret(null);
    setActiveSecret(null);
    setVaultPassword("");
  }

  function unlockVault(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    setMessage(null);
    setErrorMessage(null);

    if (unlockForm.password.length === 0 || unlockForm.password !== unlockForm.confirmPassword) {
      setErrorMessage("Vault password confirmation does not match.");
      return;
    }

    setVaultPasswordSession(unlockForm.password);
    setUnlockForm({ password: "", confirmPassword: "" });
    setMessage("Vault unlocked for this browser session.");
  }

  return (
    <main className="mx-auto flex max-w-7xl flex-col gap-5">
      <header className="flex flex-col gap-3 border-b border-slate-200 pb-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-sm font-medium text-cyan-700">
            {selectedProject?.name ?? "No project selected"} / {selectedEnvironment}
          </p>
          <h1 className="text-2xl font-semibold tracking-normal">Vault workbench</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
            Store encrypted environment secrets, reveal with a vault password, create scoped
            integration tokens, and verify external secret fetches.
          </p>
        </div>
        <Button className="w-auto" onClick={() => void loadVault()} type="button" variant="outline">
          <RefreshCw className="h-4 w-4" />
          Refresh
        </Button>
      </header>

      {message !== null ? (
        <div className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {message}
        </div>
      ) : null}

      {errorMessage !== null ? (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {errorMessage}
        </div>
      ) : null}

      <section className="grid gap-3 md:grid-cols-5">
        <Summary label="Secrets" value={vaultSummary.secrets} />
        <Summary label="Active tokens" value={vaultSummary.tokens} />
        <Summary label="Token cache" value={vaultSummary.tokenCache} />
        <Summary label="Reveal audits" value={vaultSummary.reveals} />
        <Summary label="Audit failures" value={vaultSummary.failures} />
      </section>

      <form
        className="grid gap-3 rounded-md border border-slate-200 bg-white p-4 lg:grid-cols-[1fr_1fr_auto]"
        onSubmit={unlockVault}
      >
        <Input
          onChange={(event) =>
            setUnlockForm((current) => ({ ...current, password: event.target.value }))
          }
          placeholder="vault password"
          type="password"
          value={unlockForm.password}
        />
        <Input
          onChange={(event) =>
            setUnlockForm((current) => ({ ...current, confirmPassword: event.target.value }))
          }
          placeholder="confirm vault password"
          type="password"
          value={unlockForm.confirmPassword}
        />
        <div className="flex gap-2">
          <Button className="w-auto" type="submit">
            <LockKeyhole className="h-4 w-4" />
            {vaultPasswordSession === null ? "Unlock" : "Update unlock"}
          </Button>
          <Button
            className="w-auto"
            disabled={vaultPasswordSession === null}
            onClick={() => {
              setVaultPasswordSession(null);
              setVaultPassword("");
              setRevealedSecret(null);
            }}
            type="button"
            variant="outline"
          >
            <EyeOff className="h-4 w-4" />
          </Button>
        </div>
      </form>

      <section className="flex flex-wrap gap-2">
        {dashboardEnvironments.map((environment) => (
          <Button
            className="w-auto capitalize"
            key={environment}
            onClick={() => setSelectedEnvironment(environment)}
            type="button"
            variant={selectedEnvironment === environment ? "primary" : "outline"}
          >
            {environment}
          </Button>
        ))}
      </section>

      <section className="grid gap-4 xl:grid-cols-[25rem_1fr]">
        <form className="rounded-md border border-slate-200 bg-white p-4" onSubmit={submitSecret}>
          <div className="flex items-center gap-2">
            <LockKeyhole className="h-4 w-4 text-cyan-700" />
            <h2 className="text-sm font-semibold uppercase tracking-normal text-slate-500">
              Store secret
            </h2>
          </div>
          <div className="mt-4 grid gap-3">
            <label className="text-sm font-medium">
              Environment
              <select
                className="mt-2 h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm capitalize shadow-sm outline-none focus:ring-2 focus:ring-cyan-700"
                onChange={(event) =>
                  setSecretForm((current) => ({
                    ...current,
                    environment: event.target.value as DashboardEnvironment,
                  }))
                }
                value={secretForm.environment}
              >
                {dashboardEnvironments.map((environment) => (
                  <option key={environment} value={environment}>
                    {environment}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm font-medium">
              Secret key
              <Input
                className="mt-2 font-mono"
                onChange={(event) =>
                  setSecretForm((current) => ({ ...current, key: event.target.value }))
                }
                placeholder="DATABASE_URL"
                required
                value={secretForm.key}
              />
            </label>
            <label className="text-sm font-medium">
              Secret value
              <Input
                className="mt-2"
                onChange={(event) =>
                  setSecretForm((current) => ({ ...current, value: event.target.value }))
                }
                placeholder="secret value"
                required
                type="password"
                value={secretForm.value}
              />
            </label>
            <Button disabled={selectedProject === null} type="submit">
              <Save className="h-4 w-4" />
              Save encrypted secret
            </Button>
          </div>
        </form>

        <section className="rounded-md border border-slate-200 bg-white">
          <div className="grid grid-cols-[1fr_7rem_8rem_7rem] gap-3 border-b border-slate-100 px-4 py-3 text-xs font-semibold uppercase tracking-normal text-slate-500">
            <span>Secret</span>
            <span>Version</span>
            <span>Updated</span>
            <span className="text-right">Actions</span>
          </div>
          {secrets.length === 0 ? (
            <p className="px-4 py-6 text-sm text-slate-500">
              {isLoading ? "Loading secrets" : "No active secrets for this environment"}
            </p>
          ) : (
            <div className="divide-y divide-slate-100">
              {secrets.map((secret) => (
                <article
                  className="grid grid-cols-[1fr_7rem_8rem_7rem] items-center gap-3 px-4 py-3"
                  key={secret.id}
                >
                  <div className="min-w-0">
                    <p className="truncate font-mono text-sm font-semibold text-slate-900">
                      {secret.key}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">{secret.environment}</p>
                  </div>
                  <span className="font-mono text-sm text-slate-700">v{secret.version}</span>
                  <span className="text-xs text-slate-500">
                    {formatRelativeTime(secret.updatedAt)}
                  </span>
                  <div className="flex justify-end gap-2">
                    <Button
                      className="h-9 w-9 px-0"
                      onClick={() => {
                        setActiveSecret(secret);
                        setRevealedSecret(null);
                        setVaultPassword("");
                      }}
                      type="button"
                      variant="outline"
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                    <Button
                      className="h-9 w-9 px-0"
                      onClick={() => void rotateSecret(secret)}
                      type="button"
                      variant="outline"
                    >
                      <RotateCcw className="h-4 w-4" />
                    </Button>
                    <Button
                      className="h-9 w-9 px-0"
                      onClick={() => setPendingDeleteSecret(secret)}
                      type="button"
                      variant="outline"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </section>

      <section className="grid gap-4 xl:grid-cols-[25rem_1fr]">
        <form className="rounded-md border border-slate-200 bg-white p-4" onSubmit={createToken}>
          <div className="flex items-center gap-2">
            <KeyRound className="h-4 w-4 text-cyan-700" />
            <h2 className="text-sm font-semibold uppercase tracking-normal text-slate-500">
              Integration token
            </h2>
          </div>
          <div className="mt-4 grid gap-3">
            <label className="text-sm font-medium">
              Token name
              <Input
                className="mt-2"
                onChange={(event) =>
                  setTokenForm((current) => ({ ...current, name: event.target.value }))
                }
                required
                value={tokenForm.name}
              />
            </label>
            <label className="text-sm font-medium">
              Allowed environment
              <select
                className="mt-2 h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm capitalize shadow-sm outline-none focus:ring-2 focus:ring-cyan-700"
                onChange={(event) =>
                  setTokenForm((current) => ({
                    ...current,
                    environment: event.target.value as DashboardEnvironment,
                  }))
                }
                value={tokenForm.environment}
              >
                {dashboardEnvironments.map((environment) => (
                  <option key={environment} value={environment}>
                    {environment}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm font-medium">
              Token scopes
              <div className="mt-2 grid gap-2">
                {tokenScopeOptions.map((scope) => (
                  <label
                    className="flex items-center gap-2 rounded-md border border-slate-200 px-3 py-2 text-sm"
                    key={scope}
                  >
                    <input
                      checked={tokenForm.scopes.includes(scope)}
                      onChange={(event) =>
                        setTokenForm((current) => ({
                          ...current,
                          scopes: event.target.checked
                            ? [...new Set([...current.scopes, scope])]
                            : current.scopes.filter((selectedScope) => selectedScope !== scope),
                        }))
                      }
                      type="checkbox"
                    />
                    <span className="font-mono text-xs">{scope}</span>
                  </label>
                ))}
              </div>
            </label>
            <label className="text-sm font-medium">
              Expires at
              <Input
                className="mt-2"
                onChange={(event) =>
                  setTokenForm((current) => ({ ...current, expiresAt: event.target.value }))
                }
                type="datetime-local"
                value={tokenForm.expiresAt}
              />
            </label>
            <Button disabled={selectedProject === null} type="submit">
              <ShieldCheck className="h-4 w-4" />
              Create read token
            </Button>
          </div>
        </form>

        <section className="rounded-md border border-slate-200 bg-white">
          <div className="grid grid-cols-[1fr_8rem_8rem_7rem] gap-3 border-b border-slate-100 px-4 py-3 text-xs font-semibold uppercase tracking-normal text-slate-500">
            <span>Token</span>
            <span>Status</span>
            <span>Last used</span>
            <span className="text-right">Action</span>
          </div>
          {tokens.length === 0 ? (
            <p className="px-4 py-6 text-sm text-slate-500">No integration tokens</p>
          ) : (
            <div className="divide-y divide-slate-100">
              {tokens.map((token) => (
                <article
                  className="grid grid-cols-[1fr_8rem_8rem_7rem] items-center gap-3 px-4 py-3"
                  key={token.id}
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-900">{token.name}</p>
                    <p className="mt-1 truncate font-mono text-xs text-slate-500">
                      {token.tokenPrefix} - {token.environments.join(", ") || "all"} -{" "}
                      {token.scopes.join(", ")}
                    </p>
                  </div>
                  <span className={token.status === "active" ? activeClass : revokedClass}>
                    {token.status}
                  </span>
                  <span className="text-xs text-slate-500">
                    {token.lastUsedAt === null ? "Never" : formatRelativeTime(token.lastUsedAt)}
                  </span>
                  <div className="flex justify-end">
                    <Button
                      className="h-9 w-9 px-0"
                      disabled={token.status !== "active"}
                      onClick={() => void revokeToken(token)}
                      type="button"
                      variant="outline"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </section>

      {rawToken !== null ? (
        <section className="rounded-md border border-amber-200 bg-amber-50 p-4">
          <p className="text-xs font-semibold uppercase tracking-normal text-amber-700">
            Raw integration token shown once
          </p>
          <div className="mt-2 flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <p className="break-all font-mono text-sm text-amber-950">{rawToken}</p>
            <Button
              className="w-auto"
              onClick={() => void copy(rawToken)}
              type="button"
              variant="outline"
            >
              <Clipboard className="h-4 w-4" />
              Copy
            </Button>
          </div>
        </section>
      ) : null}

      <section className="grid gap-4 xl:grid-cols-[25rem_1fr]">
        <form
          className="rounded-md border border-slate-200 bg-white p-4"
          onSubmit={testIntegrationFetch}
        >
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-cyan-700" />
            <h2 className="text-sm font-semibold uppercase tracking-normal text-slate-500">
              Test external fetch
            </h2>
          </div>
          <div className="mt-4 grid gap-3">
            <Input
              onChange={(event) =>
                setFetchForm((current) => ({ ...current, token: event.target.value }))
              }
              placeholder="raw integration token"
              type="password"
              value={fetchForm.token}
            />
            <select
              className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm capitalize shadow-sm outline-none focus:ring-2 focus:ring-cyan-700"
              onChange={(event) =>
                setFetchForm((current) => ({
                  ...current,
                  environment: event.target.value as DashboardEnvironment,
                }))
              }
              value={fetchForm.environment}
            >
              {dashboardEnvironments.map((environment) => (
                <option key={environment} value={environment}>
                  {environment}
                </option>
              ))}
            </select>
            <Input
              className="font-mono"
              onChange={(event) =>
                setFetchForm((current) => ({ ...current, key: event.target.value }))
              }
              placeholder="DATABASE_URL"
              value={fetchForm.key}
            />
            <Button type="submit">
              <Eye className="h-4 w-4" />
              Fetch via token
            </Button>
          </div>
        </form>

        <section className="rounded-md border border-slate-200 bg-white p-4">
          <h2 className="text-sm font-semibold uppercase tracking-normal text-slate-500">
            Integration instructions
          </h2>
          <Snippet
            onCopy={copy}
            title="Fetch one secret"
            value={[
              `curl -H "x-vault-token: <raw-token>" \\`,
              `  http://localhost:4000/integrations/vault/secrets/${fetchForm.environment}/${fetchForm.key || "DATABASE_URL"}`,
            ].join("\n")}
          />
          {integrationFetch !== null ? (
            <div className="mt-3 rounded-md border border-emerald-200 bg-emerald-50 p-3">
              <p className="text-xs font-semibold uppercase tracking-normal text-emerald-700">
                Fetched secret
              </p>
              <p className="mt-2 break-all font-mono text-sm text-emerald-950">
                {integrationFetch.environment}/{integrationFetch.key} = {integrationFetch.value}
              </p>
            </div>
          ) : null}
        </section>
      </section>

      <section className="rounded-md border border-slate-200 bg-white p-4">
        <h2 className="text-sm font-semibold uppercase tracking-normal text-slate-500">
          Recent vault audit
        </h2>
        <div className="mt-3 divide-y divide-slate-100">
          {auditEvents.length === 0 ? (
            <p className="py-6 text-sm text-slate-500">No audit events yet</p>
          ) : (
            auditEvents.slice(0, 8).map((event) => (
              <article key={event.id} className="grid gap-2 py-3 md:grid-cols-[1fr_8rem_8rem]">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-slate-900">{event.action}</p>
                  <p className="text-xs text-slate-500">
                    {event.environment ?? "-"} / {event.secretKey ?? event.tokenPrefix ?? "-"} by{" "}
                    {event.actorId}
                  </p>
                </div>
                <span className={event.result === "success" ? activeClass : revokedClass}>
                  {event.result}
                </span>
                <span className="text-right text-xs text-slate-500">
                  {formatRelativeTime(event.occurredAt)}
                </span>
              </article>
            ))
          )}
        </div>
      </section>

      {activeSecret !== null ? (
        <RevealPanel
          onClose={closeReveal}
          onCopy={copy}
          onReveal={() => void revealActiveSecret()}
          secret={activeSecret}
          versions={activeSecretVersions}
          setVaultPassword={setVaultPassword}
          vaultPassword={vaultPassword}
          revealedSecret={revealedSecret}
        />
      ) : null}

      <ConfirmDialog
        confirmLabel="Delete secret"
        description={
          pendingDeleteSecret === null
            ? ""
            : `This soft-deletes ${pendingDeleteSecret.environment}/${pendingDeleteSecret.key}.`
        }
        isOpen={pendingDeleteSecret !== null}
        onCancel={() => setPendingDeleteSecret(null)}
        onConfirm={() => {
          if (pendingDeleteSecret !== null) {
            void remove(pendingDeleteSecret);
          }
        }}
        title="Delete secret?"
      />
    </main>
  );
}

function RevealPanel({
  onClose,
  onCopy,
  onReveal,
  revealedSecret,
  secret,
  setVaultPassword,
  versions,
  vaultPassword,
}: {
  readonly onClose: () => void;
  readonly onCopy: (value: string) => Promise<void>;
  readonly onReveal: () => void;
  readonly revealedSecret: RevealedVaultSecret | null;
  readonly secret: VaultSecretMetadata;
  readonly setVaultPassword: (value: string) => void;
  readonly versions: VaultSecretVersion[];
  readonly vaultPassword: string;
}) {
  return (
    <section className="fixed inset-x-4 bottom-4 z-40 mx-auto max-w-2xl rounded-md border border-slate-200 bg-white p-4 shadow-xl">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-normal text-slate-500">
            Reveal secret
          </p>
          <h2 className="mt-1 font-mono text-sm font-semibold text-slate-950">
            {secret.environment}/{secret.key}
          </h2>
        </div>
        <Button
          aria-label="Close reveal panel"
          className="h-9 w-9 px-0"
          onClick={onClose}
          type="button"
          variant="outline"
        >
          <EyeOff className="h-4 w-4" />
        </Button>
      </div>
      <dl className="mt-4 grid gap-2 rounded-md border border-slate-200 bg-slate-50 p-3 text-xs md:grid-cols-2">
        <SecretDetail label="Created by" value={secret.createdBy ?? "unknown"} />
        <SecretDetail label="Updated by" value={secret.updatedBy ?? "unknown"} />
        <SecretDetail label="Created" value={formatRelativeTime(secret.createdAt)} />
        <SecretDetail label="Updated" value={formatRelativeTime(secret.updatedAt)} />
      </dl>
      <Input
        className="mt-4"
        onChange={(event) => setVaultPassword(event.target.value)}
        placeholder="vault password"
        type="password"
        value={vaultPassword}
      />
      <Button className="mt-3" onClick={onReveal} type="button">
        <Eye className="h-4 w-4" />
        Reveal value
      </Button>
      {revealedSecret !== null ? (
        <div className="mt-3 rounded-md border border-amber-200 bg-amber-50 p-3">
          <p className="text-xs font-semibold uppercase tracking-normal text-amber-700">
            Revealed value
          </p>
          <div className="mt-2 flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <p className="break-all font-mono text-sm text-amber-950">{revealedSecret.value}</p>
            <Button
              className="w-auto"
              onClick={() => void onCopy(revealedSecret.value)}
              type="button"
              variant="outline"
            >
              <Clipboard className="h-4 w-4" />
              Copy
            </Button>
          </div>
        </div>
      ) : (
        <p className="mt-3 text-sm text-slate-500">
          Enter the vault password to reveal. The value clears when this panel closes.
        </p>
      )}
      <div className="mt-4 border-t border-slate-100 pt-3">
        <p className="text-xs font-semibold uppercase tracking-normal text-slate-500">
          Version history
        </p>
        <div className="mt-2 grid gap-2">
          {versions.length === 0 ? (
            <p className="text-sm text-slate-500">No version history recorded yet.</p>
          ) : (
            versions.map((version) => (
              <div
                className="grid grid-cols-[4rem_1fr_8rem] items-center gap-2 text-xs"
                key={`${version.version}:${version.occurredAt}`}
              >
                <span className="font-mono text-slate-900">v{version.version}</span>
                <span className="truncate text-slate-600">
                  {version.status} by {version.actorId ?? "unknown"}
                </span>
                <span className="text-right text-slate-500">
                  {formatRelativeTime(version.occurredAt)}
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </section>
  );
}

function SecretDetail({ label, value }: { readonly label: string; readonly value: string }) {
  return (
    <div>
      <dt className="font-semibold uppercase tracking-normal text-slate-500">{label}</dt>
      <dd className="mt-1 truncate text-slate-900">{value}</dd>
    </div>
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
    <div className="mt-3 rounded-md border border-slate-200 bg-slate-950 p-3 text-white">
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

function Summary({ label, value }: { readonly label: string; readonly value: number | string }) {
  return (
    <div className="rounded-md border border-slate-200 bg-white p-4">
      <p className="text-sm font-medium text-slate-500">{label}</p>
      <p className="mt-3 text-2xl font-semibold tabular-nums">{value}</p>
    </div>
  );
}

const activeClass =
  "w-fit rounded-md border border-emerald-200 bg-emerald-50 px-2 py-1 text-xs font-medium capitalize text-emerald-700";

const revokedClass =
  "w-fit rounded-md border border-red-200 bg-red-50 px-2 py-1 text-xs font-medium capitalize text-red-700";

function upsertAuditEvent(events: VaultAuditEvent[], incoming: VaultAuditEvent): VaultAuditEvent[] {
  const eventsById = new Map<string, VaultAuditEvent>();

  for (const event of [incoming, ...events]) {
    eventsById.set(event.id, event);
  }

  return [...eventsById.values()].sort(
    (left, right) => Date.parse(right.occurredAt) - Date.parse(left.occurredAt),
  );
}
