import { useEffect, useState } from "react";
import { Eye, RefreshCw, Save, Trash2 } from "lucide-react";
import { listProjects, type Project } from "@/features/auth/api";
import {
  createSecret,
  createVaultToken,
  deleteSecret,
  listSecrets,
  listVaultAuditEvents,
  listVaultTokens,
  revealSecret,
  revokeVaultToken,
  type VaultAuditEvent,
  type VaultSecretMetadata,
  type VaultToken,
} from "@/features/vault/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { chooseDefaultProject, formatRelativeTime } from "./dashboard-utils";

export function VaultPage() {
  const [project, setProject] = useState<Project | null>(null);
  const [secrets, setSecrets] = useState<VaultSecretMetadata[]>([]);
  const [tokens, setTokens] = useState<VaultToken[]>([]);
  const [auditEvents, setAuditEvents] = useState<VaultAuditEvent[]>([]);
  const [revealedValue, setRevealedValue] = useState<string | null>(null);
  const [rawToken, setRawToken] = useState<string | null>(null);
  const [form, setForm] = useState({
    environment: "production",
    key: "",
    value: "",
    vaultPassword: "",
    tokenName: "production-reader",
    tokenEnvironment: "production",
  });
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function loadVault(): Promise<void> {
    setErrorMessage(null);

    try {
      const projects = await listProjects();
      const selectedProject = chooseDefaultProject(projects);
      setProject(selectedProject);

      if (selectedProject === null) {
        setSecrets([]);
        setTokens([]);
        setAuditEvents([]);
        return;
      }

      const [secretList, tokenList, events] = await Promise.all([
        listSecrets(selectedProject.id),
        listVaultTokens(selectedProject.id),
        listVaultAuditEvents(selectedProject.id),
      ]);
      setSecrets(secretList);
      setTokens(tokenList);
      setAuditEvents(events);
    } catch {
      setErrorMessage("Vault data is unavailable.");
    }
  }

  useEffect(() => {
    void loadVault();
  }, []);

  async function submitSecret(): Promise<void> {
    if (project === null || form.key.trim().length === 0 || form.value.length === 0) {
      return;
    }

    const secret = await createSecret({
      projectId: project.id,
      environment: form.environment,
      key: form.key,
      value: form.value,
    });
    setSecrets((current) => [secret, ...current]);
    setForm((current) => ({ ...current, key: "", value: "" }));
    await loadVault();
  }

  async function reveal(secret: VaultSecretMetadata): Promise<void> {
    if (form.vaultPassword.length === 0) {
      setErrorMessage("Vault password is required to reveal secrets.");
      return;
    }

    const revealed = await revealSecret(
      secret.projectId,
      secret.environment,
      secret.key,
      form.vaultPassword,
    );
    setRevealedValue(`${revealed.environment}/${revealed.key} = ${revealed.value}`);
    await loadVault();
  }

  async function remove(secret: VaultSecretMetadata): Promise<void> {
    await deleteSecret(secret.projectId, secret.environment, secret.key);
    setSecrets((current) => current.filter((item) => item.id !== secret.id));
    await loadVault();
  }

  async function createToken(): Promise<void> {
    if (project === null || form.tokenName.trim().length === 0) {
      return;
    }

    const created = await createVaultToken({
      projectId: project.id,
      name: form.tokenName,
      scopes: ["secrets:read"],
      environments:
        form.tokenEnvironment.trim().length === 0 ? [] : [form.tokenEnvironment.trim()],
    });
    setRawToken(created.rawToken);
    await loadVault();
  }

  async function revokeToken(token: VaultToken): Promise<void> {
    await revokeVaultToken(token.projectId, token.id);
    await loadVault();
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-5 text-slate-950 sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-7xl flex-col gap-5">
        <header className="flex flex-col gap-3 border-b border-slate-200 pb-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm font-medium text-cyan-700">
              {project?.name ?? "No project selected"}
            </p>
            <h1 className="text-2xl font-semibold tracking-normal">Encrypted vault</h1>
          </div>
          <Button type="button" variant="outline" onClick={() => void loadVault()}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
        </header>

        {errorMessage !== null ? (
          <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {errorMessage}
          </div>
        ) : null}

        <section className="grid gap-4 xl:grid-cols-[26rem_1fr]">
          <form
            className="rounded-md border border-slate-200 bg-white p-4"
            onSubmit={(event) => {
              event.preventDefault();
              void submitSecret();
            }}
          >
            <h2 className="text-sm font-semibold uppercase tracking-normal text-slate-500">
              Store Secret
            </h2>
            <div className="mt-4 grid gap-3">
              <Input
                value={form.environment}
                onChange={(event) =>
                  setForm((current) => ({ ...current, environment: event.target.value }))
                }
                placeholder="environment"
              />
              <Input
                value={form.key}
                onChange={(event) => setForm((current) => ({ ...current, key: event.target.value }))}
                placeholder="SECRET_KEY"
              />
              <Input
                value={form.value}
                onChange={(event) =>
                  setForm((current) => ({ ...current, value: event.target.value }))
                }
                placeholder="secret value"
                type="password"
              />
              <Input
                value={form.vaultPassword}
                onChange={(event) =>
                  setForm((current) => ({ ...current, vaultPassword: event.target.value }))
                }
                placeholder="vault password for reveal"
                type="password"
              />
              <Button type="submit">
                <Save className="mr-2 h-4 w-4" />
                Save encrypted secret
              </Button>
            </div>
          </form>

          <section className="rounded-md border border-slate-200 bg-white p-4">
            <h2 className="text-sm font-semibold uppercase tracking-normal text-slate-500">
              Secrets
            </h2>
            {revealedValue !== null ? (
              <div className="mt-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 font-mono text-sm text-amber-800">
                {revealedValue}
              </div>
            ) : null}
            <div className="mt-3 divide-y divide-slate-100">
              {secrets.length === 0 ? (
                <p className="py-6 text-sm text-slate-500">No active secrets</p>
              ) : (
                secrets.map((secret) => (
                  <article
                    key={secret.id}
                    className="grid grid-cols-[1fr_8rem_6rem] items-center gap-3 py-3"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-slate-900">{secret.key}</p>
                      <p className="text-xs text-slate-500">
                        {secret.environment} - v{secret.version} -{" "}
                        {formatRelativeTime(secret.updatedAt)}
                      </p>
                    </div>
                    <span className="text-sm capitalize text-slate-600">{secret.status}</span>
                    <div className="flex justify-end gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        className="h-9 w-9 px-0"
                        onClick={() => void reveal(secret)}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        className="h-9 w-9 px-0"
                        onClick={() => void remove(secret)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </article>
                ))
              )}
            </div>
          </section>
        </section>

        <section className="grid gap-4 xl:grid-cols-[26rem_1fr]">
          <form
            className="rounded-md border border-slate-200 bg-white p-4"
            onSubmit={(event) => {
              event.preventDefault();
              void createToken();
            }}
          >
            <h2 className="text-sm font-semibold uppercase tracking-normal text-slate-500">
              Integration Token
            </h2>
            <div className="mt-4 grid gap-3">
              <Input
                value={form.tokenName}
                onChange={(event) =>
                  setForm((current) => ({ ...current, tokenName: event.target.value }))
                }
                placeholder="token name"
              />
              <Input
                value={form.tokenEnvironment}
                onChange={(event) =>
                  setForm((current) => ({ ...current, tokenEnvironment: event.target.value }))
                }
                placeholder="allowed environment"
              />
              <Button type="submit">Create read token</Button>
            </div>
            {rawToken !== null ? (
              <div className="mt-3 rounded-md border border-amber-200 bg-amber-50 p-3 font-mono text-xs text-amber-800">
                {rawToken}
              </div>
            ) : null}
          </form>

          <section className="rounded-md border border-slate-200 bg-white p-4">
            <h2 className="text-sm font-semibold uppercase tracking-normal text-slate-500">
              Tokens
            </h2>
            <div className="mt-3 divide-y divide-slate-100">
              {tokens.length === 0 ? (
                <p className="py-6 text-sm text-slate-500">No integration tokens</p>
              ) : (
                tokens.map((token) => (
                  <article
                    key={token.id}
                    className="grid grid-cols-[1fr_8rem_5rem] items-center gap-3 py-3"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-slate-900">
                        {token.name}
                      </p>
                      <p className="text-xs text-slate-500">
                        {token.tokenPrefix} - {token.environments.join(", ") || "all"}
                      </p>
                    </div>
                    <span className="text-sm capitalize text-slate-600">{token.status}</span>
                    <Button
                      type="button"
                      variant="outline"
                      className="h-9 w-9 px-0"
                      onClick={() => void revokeToken(token)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </article>
                ))
              )}
            </div>
          </section>
        </section>

        <section className="rounded-md border border-slate-200 bg-white p-4">
          <h2 className="text-sm font-semibold uppercase tracking-normal text-slate-500">
            Vault Audit
          </h2>
          <div className="mt-3 divide-y divide-slate-100">
            {auditEvents.length === 0 ? (
              <p className="py-6 text-sm text-slate-500">No audit events yet</p>
            ) : (
              auditEvents.slice(0, 12).map((event) => (
                <article key={event.id} className="grid gap-2 py-3 md:grid-cols-[1fr_8rem_8rem]">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-900">{event.action}</p>
                    <p className="text-xs text-slate-500">
                      {event.environment ?? "-"} / {event.secretKey ?? "-"} by {event.actorId}
                    </p>
                  </div>
                  <span className="text-sm capitalize text-slate-600">{event.result}</span>
                  <span className="text-right text-xs text-slate-500">
                    {formatRelativeTime(event.occurredAt)}
                  </span>
                </article>
              ))
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
