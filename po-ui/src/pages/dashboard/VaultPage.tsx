import { useEffect, useState } from "react";
import { Eye, RefreshCw, Save, Trash2 } from "lucide-react";
import { listProjects, type Project } from "@/features/auth/api";
import {
  createSecret,
  deleteSecret,
  listSecrets,
  listVaultAuditEvents,
  revealSecret,
  type VaultAuditEvent,
  type VaultSecretMetadata,
} from "@/features/vault/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { chooseDefaultProject, formatRelativeTime } from "./dashboard-utils";

export function VaultPage() {
  const [project, setProject] = useState<Project | null>(null);
  const [secrets, setSecrets] = useState<VaultSecretMetadata[]>([]);
  const [auditEvents, setAuditEvents] = useState<VaultAuditEvent[]>([]);
  const [revealedValue, setRevealedValue] = useState<string | null>(null);
  const [form, setForm] = useState({
    environment: "production",
    key: "",
    value: "",
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
        setAuditEvents([]);
        return;
      }

      const [secretList, events] = await Promise.all([
        listSecrets(selectedProject.id),
        listVaultAuditEvents(selectedProject.id),
      ]);
      setSecrets(secretList);
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
    const revealed = await revealSecret(secret.projectId, secret.environment, secret.key);
    setRevealedValue(`${revealed.environment}/${revealed.key} = ${revealed.value}`);
    await loadVault();
  }

  async function remove(secret: VaultSecretMetadata): Promise<void> {
    await deleteSecret(secret.projectId, secret.environment, secret.key);
    setSecrets((current) => current.filter((item) => item.id !== secret.id));
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
