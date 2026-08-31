import {
  AlertTriangle,
  Binary,
  CheckCircle2,
  Clipboard,
  Database,
  Eye,
  EyeOff,
  History,
  KeyRound,
  Layers,
  LockKeyhole,
  Play,
  Plus,
  RefreshCw,
  RotateCcw,
  Save,
  ShieldCheck,
  Sparkles,
  Terminal,
  Trash2,
  X,
  Zap,
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
import {
  createVaultPolicy,
  deleteVaultPolicy,
  destroySecretVersion,
  generateDynamicDbCredential,
  listDynamicDbCredentials,
  listVaultPolicies,
  renewDynamicDbLease,
  revokeDynamicDbLease,
  rotateTransitKey,
  simulateVaultPolicy,
  softDeleteSecretVersion,
  transitDecrypt,
  transitEncrypt,
  undeleteSecretVersion,
  updateSecretMetadata,
  type DynamicDatabaseCredential,
  type PolicySimulationResult,
  type VaultCapability,
  type VaultPolicy,
  type VaultPolicyRule,
} from "@/features/vault-policies/api";
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

type VaultTab = "kv" | "policies" | "dynamic" | "transit";

type SecretForm = {
  readonly environment: DashboardEnvironment;
  readonly key: string;
  readonly value: string;
};

export function VaultPage() {
  const { selectedEnvironment, selectedProject, setSelectedEnvironment } = useDashboardContext();

  // Active Main Tab
  const [activeTab, setActiveTab] = useState<VaultTab>("kv");

  // KV Secrets State
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

  // --- POLICIES STATE ---
  const [policies, setPolicies] = useState<VaultPolicy[]>([]);
  const [isCreatingPolicy, setIsCreatingPolicy] = useState(false);
  const [newPolicyName, setNewPolicyName] = useState("");
  const [newPolicyDesc, setNewPolicyDesc] = useState("");
  const [newPolicyRules, setNewPolicyRules] = useState<VaultPolicyRule[]>([
    { path: "secret/data/staging/*", capabilities: ["read", "list"] },
  ]);
  const [newRulePath, setNewRulePath] = useState("");
  const [newRuleCap, setNewRuleCap] = useState<VaultCapability>("read");

  // Simulator State
  const [simPath, setSimPath] = useState("secret/data/production/database");
  const [simCap, setSimCap] = useState<VaultCapability>("read");
  const [simResult, setSimResult] = useState<PolicySimulationResult | null>(null);
  const [isSimulating, setIsSimulating] = useState(false);

  // --- DYNAMIC DATABASE CREDENTIALS STATE ---
  const [dynamicLeases, setDynamicLeases] = useState<DynamicDatabaseCredential[]>([]);
  const [dynamicEngine, setDynamicEngine] = useState<"postgres" | "mysql" | "mongodb">("postgres");
  const [dynamicRole, setDynamicRole] = useState("readonly");
  const [dynamicTtl, setDynamicTtl] = useState(3600);
  const [isGeneratingDynamic, setIsGeneratingDynamic] = useState(false);

  // --- TRANSIT CRYPTOGRAPHY STATE ---
  const [transitKeyName, setTransitKeyName] = useState("primary-app-key");
  const [transitPlaintext, setTransitPlaintext] = useState("Hello PulseOps Enterprise Security");
  const [transitCiphertext, setTransitCiphertext] = useState("");
  const [transitDecryptedText, setTransitDecryptedText] = useState("");
  const [transitKeyVersion, setTransitKeyVersion] = useState(1);

  // Loaders
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
      const [secretList, tokenList, tokenCache, events, policyList, dynamicList] = await Promise.all([
        listSecrets(selectedProject.id, selectedEnvironment),
        listVaultTokens(selectedProject.id),
        getVaultTokenCacheDiagnostics(selectedProject.id),
        listVaultAuditEvents(selectedProject.id),
        listVaultPolicies(selectedProject.id).catch(() => []),
        listDynamicDbCredentials(selectedProject.id).catch(() => []),
      ]);
      setSecrets(secretList);
      setTokens(tokenList);
      setTokenCacheDiagnostics(tokenCache);
      setAuditEvents(events);
      setPolicies(policyList);
      setDynamicLeases(dynamicList);
    } catch (requestError) {
      setErrorMessage(getApiErrorMessage(requestError));
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadVault();
  }, [selectedEnvironment, selectedProject?.id]);

  useEffect(() => {
    setSecretForm((current) => ({ ...current, environment: selectedEnvironment }));
    setTokenForm((current) => ({ ...current, environment: selectedEnvironment }));
    setFetchForm((current) => ({ ...current, environment: selectedEnvironment }));
  }, [selectedEnvironment]);

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

    socket.on("vault.audit.created", (incoming: RealtimeVaultAuditCreated) => {
      setAuditEvents((current) => upsertAuditEvent(current, incoming.auditEvent));
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

    let isMounted = true;

    async function loadVersions(): Promise<void> {
      if (activeSecret === null) return;
      try {
        const next = await listSecretVersions(
          activeSecret.projectId,
          activeSecret.environment,
          activeSecret.key,
        );
        if (isMounted) {
          setActiveSecretVersions(next);
        }
      } catch {
        if (isMounted) {
          setActiveSecretVersions([]);
        }
      }
    }

    void loadVersions();

    return () => {
      isMounted = false;
    };
  }, [activeSecret]);

  // Actions
  async function copy(value: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(value);
      setMessage("Copied to clipboard.");
    } catch {
      setErrorMessage("Could not copy value.");
    }
  }

  function unlockVault(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    if (unlockForm.password.length === 0) {
      setErrorMessage("Password is required.");
      return;
    }
    if (unlockForm.password !== unlockForm.confirmPassword) {
      setErrorMessage("Passwords do not match.");
      return;
    }
    setVaultPasswordSession(unlockForm.password);
    setVaultPassword(unlockForm.password);
    setUnlockForm({ password: "", confirmPassword: "" });
    setMessage("Vault session unlocked.");
  }

  function closeReveal(): void {
    setActiveSecret(null);
    setRevealedSecret(null);
    setVaultPassword(vaultPasswordSession ?? "");
  }

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
      setMessage("Secret stored securely.");
      await loadVault();
    } catch (requestError) {
      setErrorMessage(getApiErrorMessage(requestError));
    }
  }

  async function rotateSecret(secret: VaultSecretMetadata): Promise<void> {
    if (secretForm.value.length === 0) {
      setErrorMessage("Enter a new secret value in the form before rotating.");
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
      setMessage("Secret rotated to next version.");
      await loadVault();
    } catch (requestError) {
      setErrorMessage(getApiErrorMessage(requestError));
    }
  }

  async function revealActiveSecret(): Promise<void> {
    if (activeSecret === null) return;
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
    if (selectedProject === null) return;
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

  // --- POLICIES & SIMULATOR HANDLERS ---
  const handleSimulatePolicy = async (e: FormEvent) => {
    e.preventDefault();
    if (!selectedProject || !simPath.trim()) return;
    setIsSimulating(true);
    try {
      const res = await simulateVaultPolicy(selectedProject.id, {
        path: simPath.trim(),
        capability: simCap,
        environment: selectedEnvironment,
      });
      setSimResult(res);
    } catch (err) {
      setErrorMessage(getApiErrorMessage(err));
    } finally {
      setIsSimulating(false);
    }
  };

  const handleCreatePolicy = async (e: FormEvent) => {
    e.preventDefault();
    if (!selectedProject || !newPolicyName.trim() || newPolicyRules.length === 0) return;
    try {
      const created = await createVaultPolicy(selectedProject.id, {
        name: newPolicyName.trim(),
        description: newPolicyDesc.trim() || undefined,
        rules: newPolicyRules,
      });
      setPolicies([...policies, created]);
      setIsCreatingPolicy(false);
      setNewPolicyName("");
      setNewPolicyDesc("");
      setMessage(`Policy "${created.name}" created.`);
    } catch (err) {
      setErrorMessage(getApiErrorMessage(err));
    }
  };

  const handleDeletePolicy = async (policyId: string) => {
    if (!selectedProject) return;
    try {
      await deleteVaultPolicy(selectedProject.id, policyId);
      setPolicies(policies.filter((p) => p.id !== policyId));
      setMessage("Policy deleted.");
    } catch (err) {
      setErrorMessage(getApiErrorMessage(err));
    }
  };

  // --- DYNAMIC DATABASE HANDLERS ---
  const handleGenerateDynamicDb = async (e: FormEvent) => {
    e.preventDefault();
    if (!selectedProject) return;
    setIsGeneratingDynamic(true);
    try {
      const cred = await generateDynamicDbCredential(selectedProject.id, {
        engine: dynamicEngine,
        role: dynamicRole,
        ttlSeconds: Number(dynamicTtl),
      });
      setDynamicLeases([cred, ...dynamicLeases]);
      setMessage(`Generated leased credentials for ${cred.engine.toUpperCase()}.`);
    } catch (err) {
      setErrorMessage(getApiErrorMessage(err));
    } finally {
      setIsGeneratingDynamic(false);
    }
  };

  const handleRevokeDynamicLease = async (leaseId: string) => {
    if (!selectedProject) return;
    try {
      await revokeDynamicDbLease(selectedProject.id, leaseId);
      setDynamicLeases(dynamicLeases.filter((l) => l.leaseId !== leaseId));
      setMessage("Lease revoked immediately.");
    } catch (err) {
      setErrorMessage(getApiErrorMessage(err));
    }
  };

  // --- TRANSIT HANDLERS ---
  const handleTransitEncrypt = async (e: FormEvent) => {
    e.preventDefault();
    if (!selectedProject || !transitPlaintext.trim()) return;
    try {
      const res = await transitEncrypt(selectedProject.id, {
        keyName: transitKeyName.trim(),
        plaintext: transitPlaintext,
      });
      setTransitCiphertext(res.ciphertext);
      setTransitKeyVersion(res.keyVersion);
      setMessage("Data encrypted with customer-managed transit key.");
    } catch (err) {
      setErrorMessage(getApiErrorMessage(err));
    }
  };

  const handleTransitDecrypt = async (e: FormEvent) => {
    e.preventDefault();
    if (!selectedProject || !transitCiphertext.trim()) return;
    try {
      const res = await transitDecrypt(selectedProject.id, {
        keyName: transitKeyName.trim(),
        ciphertext: transitCiphertext.trim(),
      });
      setTransitDecryptedText(res.plaintext);
      setMessage("Transit ciphertext decrypted successfully.");
    } catch (err) {
      setErrorMessage(getApiErrorMessage(err));
    }
  };

  const handleRotateTransitKey = async () => {
    if (!selectedProject) return;
    try {
      const res = await rotateTransitKey(selectedProject.id, transitKeyName.trim());
      setTransitKeyVersion(res.newVersion);
      setMessage(`Rotated transit key to version v${res.newVersion}.`);
    } catch (err) {
      setErrorMessage(getApiErrorMessage(err));
    }
  };

  const vaultSummary = useMemo(() => {
    const reveals = auditEvents.filter((event) => event.action === "secret.revealed").length;
    const failures = auditEvents.filter((event) => event.result === "failure").length;
    return {
      secrets: secrets.length,
      tokens: tokens.filter((token) => token.status === "active").length,
      tokenCache: tokenCacheDiagnostics?.cachedTokens ?? 0,
      reveals,
      failures,
      policies: policies.length,
      dynamicLeases: dynamicLeases.length,
    };
  }, [auditEvents, secrets.length, tokenCacheDiagnostics, tokens, policies.length, dynamicLeases.length]);

  return (
    <main className="space-y-6 pb-16">
      {/* Top Header Bar */}
      <header className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-tr from-cyan-500/20 to-indigo-500/20 text-cyan-400 border border-cyan-500/30 shadow-lg shadow-cyan-500/10">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2.5">
              Vault & Secret Engines
            </h1>
            <p className="text-sm text-zinc-400">
              Zero-knowledge envelope encryption, RBAC policy simulation, leased DB credentials, and transit cryptography.
            </p>
          </div>
        </div>

        {/* Global Toolbar Tabs */}
        <div className="flex rounded-xl bg-zinc-950 p-1.5 border border-zinc-800 backdrop-blur-md">
          {[
            { id: "kv", label: "KV Secrets (v2)", count: vaultSummary.secrets, icon: LockKeyhole },
            { id: "policies", label: "Access Policies & RBAC", count: vaultSummary.policies, icon: ShieldCheck },
            { id: "dynamic", label: "Dynamic DB Credentials", count: vaultSummary.dynamicLeases, icon: Database },
            { id: "transit", label: "Transit Cryptography", icon: Binary },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id as VaultTab)}
                className={`flex items-center gap-2 rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-all ${
                  isActive
                    ? "bg-cyan-600 text-white shadow-md"
                    : "text-zinc-400 hover:text-white hover:bg-zinc-850"
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                <span>{tab.label}</span>
                {tab.count !== undefined && tab.count > 0 && (
                  <span
                    className={`rounded-full px-1.5 py-0.2 text-[10px] font-bold ${
                      isActive ? "bg-white/20 text-white" : "bg-zinc-800 text-zinc-300"
                    }`}
                  >
                    {tab.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </header>

      {/* Messages */}
      {message !== null && (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-950/20 px-4 py-3 text-xs font-semibold text-emerald-400 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4" />
          {message}
        </div>
      )}

      {errorMessage !== null && (
        <div className="rounded-xl border border-rose-500/30 bg-rose-950/20 px-4 py-3 text-xs font-semibold text-rose-400 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4" />
          {errorMessage}
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 1: KV SECRETS (v2) */}
      {/* ========================================================================= */}
      {activeTab === "kv" && (
        <div className="space-y-6">
          <section className="grid gap-3 grid-cols-2 md:grid-cols-5">
            <Summary label="Secrets" value={vaultSummary.secrets} />
            <Summary label="Active Tokens" value={vaultSummary.tokens} />
            <Summary label="Token Cache" value={vaultSummary.tokenCache} />
            <Summary label="Reveal Audits" value={vaultSummary.reveals} />
            <Summary label="Audit Failures" value={vaultSummary.failures} />
          </section>

          {/* Master Unlock Panel */}
          <form
            className="grid gap-3 rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4 lg:grid-cols-[1fr_1fr_auto] backdrop-blur-md"
            onSubmit={unlockVault}
          >
            <Input
              onChange={(event) =>
                setUnlockForm((current) => ({ ...current, password: event.target.value }))
              }
              placeholder="Session master password"
              type="password"
              value={unlockForm.password}
              className="bg-zinc-950 border-zinc-800 text-xs text-white"
            />
            <Input
              onChange={(event) =>
                setUnlockForm((current) => ({ ...current, confirmPassword: event.target.value }))
              }
              placeholder="Confirm master password"
              type="password"
              value={unlockForm.confirmPassword}
              className="bg-zinc-950 border-zinc-800 text-xs text-white"
            />
            <div className="flex gap-2">
              <Button className="bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold" type="submit">
                <LockKeyhole className="h-3.5 w-3.5 mr-1" />
                {vaultPasswordSession === null ? "Unlock Session" : "Update Unlock"}
              </Button>
              {vaultPasswordSession !== null && (
                <Button
                  onClick={() => {
                    setVaultPasswordSession(null);
                    setVaultPassword("");
                    setRevealedSecret(null);
                  }}
                  type="button"
                  variant="outline"
                  className="text-xs border-zinc-700 text-zinc-300"
                >
                  <EyeOff className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          </form>

          {/* Environment Selector Strip */}
          <section className="flex flex-wrap gap-2">
            {dashboardEnvironments.map((environment) => (
              <button
                key={environment}
                onClick={() => setSelectedEnvironment(environment)}
                type="button"
                className={`px-3.5 py-1.5 rounded-lg text-xs font-bold uppercase transition-all ${
                  selectedEnvironment === environment
                    ? "bg-zinc-800 text-cyan-400 border border-cyan-500/30 shadow-sm"
                    : "text-zinc-500 hover:text-zinc-300 bg-zinc-950 border border-zinc-900"
                }`}
              >
                {environment}
              </button>
            ))}
          </section>

          {/* Secret Store Form & Secret Table */}
          <section className="grid gap-6 xl:grid-cols-[25rem_1fr]">
            <form className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5 space-y-4 backdrop-blur-md" onSubmit={submitSecret}>
              <div className="flex items-center gap-2 border-b border-zinc-800 pb-3">
                <LockKeyhole className="h-4 w-4 text-cyan-400" />
                <h3 className="text-sm font-bold text-white">Store Encrypted KV Secret</h3>
              </div>

              <div className="space-y-3">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-zinc-300">Environment</label>
                  <select
                    className="w-full h-9 rounded-lg bg-zinc-950 border border-zinc-800 px-3 text-xs text-zinc-200 uppercase font-semibold focus:outline-none"
                    onChange={(event) =>
                      setSecretForm((current) => ({
                        ...current,
                        environment: event.target.value as DashboardEnvironment,
                      }))
                    }
                    value={secretForm.environment}
                  >
                    {dashboardEnvironments.map((env) => (
                      <option key={env} value={env}>
                        {env.toUpperCase()}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-zinc-300">Secret Key</label>
                  <Input
                    className="font-mono bg-zinc-950 border-zinc-800 text-xs text-white"
                    onChange={(event) =>
                      setSecretForm((current) => ({ ...current, key: event.target.value }))
                    }
                    placeholder="DATABASE_URL"
                    required
                    value={secretForm.key}
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-zinc-300">Secret Value</label>
                  <Input
                    className="bg-zinc-950 border-zinc-800 text-xs text-white"
                    onChange={(event) =>
                      setSecretForm((current) => ({ ...current, value: event.target.value }))
                    }
                    placeholder="e.g. postgres://user:pass@host:5432/db"
                    required
                    type="password"
                    value={secretForm.value}
                  />
                </div>

                <Button className="w-full bg-cyan-600 hover:bg-cyan-500 text-white font-semibold text-xs h-9" disabled={selectedProject === null} type="submit">
                  <Save className="h-3.5 w-3.5 mr-1" />
                  Save Encrypted Secret (AES-256-GCM)
                </Button>
              </div>
            </form>

            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5 backdrop-blur-md space-y-3 overflow-x-auto">
              <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Layers className="w-4 h-4 text-cyan-400" />
                  Active Secrets in {selectedEnvironment.toUpperCase()} ({secrets.length})
                </h3>
              </div>

              {secrets.length === 0 ? (
                <p className="py-8 text-center text-xs text-zinc-500">
                  {isLoading ? "Loading encrypted secrets..." : "No active secrets stored for this environment."}
                </p>
              ) : (
                <div className="divide-y divide-zinc-850">
                  {secrets.map((secret) => (
                    <article
                      className="flex items-center justify-between py-3 gap-3"
                      key={secret.id}
                    >
                      <div>
                        <p className="font-mono text-sm font-bold text-white">{secret.key}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="px-1.5 py-0.2 rounded text-[10px] font-mono bg-zinc-800 text-zinc-300">
                            v{secret.version}
                          </span>
                          <span className="text-[11px] text-zinc-500">
                            Updated {formatRelativeTime(secret.updatedAt)}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <Button
                          className="h-8 w-8 px-0 bg-zinc-800 text-zinc-300 hover:text-white"
                          onClick={() => {
                            setActiveSecret(secret);
                            setRevealedSecret(null);
                            setVaultPassword("");
                          }}
                          type="button"
                          title="Reveal & Inspect Versions"
                        >
                          <Eye className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          className="h-8 w-8 px-0 bg-zinc-800 text-zinc-300 hover:text-white"
                          onClick={() => void rotateSecret(secret)}
                          type="button"
                          title="Rotate Secret"
                        >
                          <RotateCcw className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          className="h-8 w-8 px-0 bg-zinc-800 text-zinc-300 hover:text-rose-400"
                          onClick={() => setPendingDeleteSecret(secret)}
                          type="button"
                          title="Soft Delete Secret"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </div>
          </section>

          {/* Integration Tokens & Diagnostics */}
          <section className="grid gap-6 xl:grid-cols-[25rem_1fr]">
            <form className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5 space-y-4 backdrop-blur-md" onSubmit={createToken}>
              <div className="flex items-center gap-2 border-b border-zinc-800 pb-3">
                <KeyRound className="h-4 w-4 text-cyan-400" />
                <h3 className="text-sm font-bold text-white">Create Integration Token</h3>
              </div>

              <div className="space-y-3">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-zinc-300">Token Name</label>
                  <Input
                    className="bg-zinc-950 border-zinc-800 text-xs text-white"
                    onChange={(event) =>
                      setTokenForm((current) => ({ ...current, name: event.target.value }))
                    }
                    required
                    value={tokenForm.name}
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-zinc-300">Scopes</label>
                  <div className="flex gap-2">
                    {tokenScopeOptions.map((scope) => (
                      <span key={scope} className="px-2.5 py-1 rounded bg-zinc-950 border border-zinc-800 text-xs font-mono text-zinc-300">
                        {scope}
                      </span>
                    ))}
                  </div>
                </div>

                <Button className="w-full bg-cyan-600 hover:bg-cyan-500 text-white font-semibold text-xs h-9" type="submit">
                  Generate Token
                </Button>
              </div>

              {rawToken && (
                <div className="mt-3 p-3 rounded-xl bg-zinc-950 border border-cyan-500/40 space-y-1 font-mono text-xs">
                  <span className="text-[10px] text-cyan-400 font-bold uppercase">Raw Token (Copy Now):</span>
                  <p className="text-white break-all">{rawToken}</p>
                </div>
              )}
            </form>

            {/* Token List & Live Audit Events */}
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5 backdrop-blur-md space-y-4">
              <h3 className="text-sm font-bold text-white flex items-center gap-2 border-b border-zinc-800 pb-3">
                <History className="w-4 h-4 text-cyan-400" />
                Recent Real-Time Vault Audit Stream
              </h3>

              <div className="space-y-2 max-h-56 overflow-y-auto divide-y divide-zinc-850">
                {auditEvents.length === 0 ? (
                  <p className="py-6 text-xs text-zinc-500 text-center">No vault audit events recorded yet.</p>
                ) : (
                  auditEvents.slice(0, 10).map((event) => (
                    <div key={event.id} className="pt-2 flex items-center justify-between text-xs">
                      <div>
                        <span className="font-bold text-white font-mono">{event.action}</span>
                        <p className="text-[11px] text-zinc-400">
                          {event.environment} / {event.secretKey ?? event.tokenPrefix ?? "system"} by {event.actorId}
                        </p>
                      </div>
                      <div className="text-right">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                          event.result === "success"
                            ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                            : "bg-rose-500/10 text-rose-400 border border-rose-500/20"
                        }`}>
                          {event.result}
                        </span>
                        <p className="text-[10px] text-zinc-500 font-mono mt-0.5">{formatRelativeTime(event.occurredAt)}</p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </section>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: ACCESS POLICIES & RBAC SIMULATOR */}
      {/* ========================================================================= */}
      {activeTab === "policies" && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 rounded-xl bg-zinc-900/60 border border-zinc-800/80 backdrop-blur-md">
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-cyan-400" />
                Granular Path Access Policies & Simulation
              </h3>
              <p className="text-xs text-zinc-400 mt-0.5">
                Enforce strict deny-by-default access rules, project/environment permissions, and safe verification.
              </p>
            </div>

            <Button
              onClick={() => setIsCreatingPolicy(true)}
              className="bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold h-8 gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" />
              New Policy
            </Button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Policy List */}
            <div className="space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-400">
                Active Vault Policies ({policies.length})
              </h4>

              <div className="space-y-3">
                {policies.map((pol) => (
                  <div
                    key={pol.id}
                    className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5 backdrop-blur-md space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <h5 className="text-sm font-bold text-white font-mono">{pol.name}</h5>
                        {pol.isDefault && (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                            DEFAULT
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-zinc-500 font-mono">v{pol.version}</span>
                        {!pol.isDefault && (
                          <button
                            onClick={() => handleDeletePolicy(pol.id)}
                            className="text-zinc-500 hover:text-rose-400 p-1"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>

                    {pol.description && (
                      <p className="text-xs text-zinc-400">{pol.description}</p>
                    )}

                    <div className="space-y-1.5 pt-2 border-t border-zinc-800/80">
                      {pol.rules.map((rule: VaultPolicyRule, rIdx: number) => (
                        <div
                          key={rIdx}
                          className="flex items-center justify-between rounded-lg bg-zinc-950 p-2 border border-zinc-850 text-xs font-mono"
                        >
                          <span className="text-zinc-200">{rule.path}</span>
                          <div className="flex gap-1">
                            {rule.capabilities.map((cap: VaultCapability) => (
                              <span
                                key={cap}
                                className={`px-1.5 py-0.2 rounded text-[9px] font-bold uppercase ${
                                  cap === "deny"
                                    ? "bg-rose-500/20 text-rose-400 border border-rose-500/30"
                                    : cap === "sudo"
                                      ? "bg-purple-500/20 text-purple-400 border border-purple-500/30"
                                      : "bg-zinc-800 text-zinc-300"
                                }`}
                              >
                                {cap}
                              </span>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Policy Simulator Console */}
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-6 backdrop-blur-md space-y-4">
              <div className="flex items-center gap-2 border-b border-zinc-800 pb-3">
                <Terminal className="w-4 h-4 text-cyan-400" />
                <h4 className="text-sm font-bold text-white">Live Policy Simulator & Evaluator</h4>
              </div>

              <form onSubmit={handleSimulatePolicy} className="space-y-3">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-zinc-300">Target Path</label>
                  <Input
                    value={simPath}
                    onChange={(e) => setSimPath(e.target.value)}
                    placeholder="e.g. secret/data/production/api_key"
                    className="bg-zinc-950 border-zinc-800 font-mono text-xs text-white"
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-zinc-300">Requested Capability</label>
                    <select
                      value={simCap}
                      onChange={(e) => setSimCap(e.target.value as VaultCapability)}
                      className="w-full h-9 rounded-lg bg-zinc-950 border border-zinc-800 px-3 text-xs text-zinc-200 uppercase font-semibold focus:outline-none"
                    >
                      <option value="read">READ</option>
                      <option value="create">CREATE</option>
                      <option value="update">UPDATE</option>
                      <option value="delete">DELETE</option>
                      <option value="list">LIST</option>
                      <option value="sudo">SUDO</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-zinc-300">Environment Context</label>
                    <div className="h-9 px-3 rounded-lg bg-zinc-950 border border-zinc-800 flex items-center text-xs font-mono text-zinc-300 uppercase">
                      {selectedEnvironment}
                    </div>
                  </div>
                </div>

                <Button
                  type="submit"
                  disabled={isSimulating}
                  className="w-full bg-cyan-600 hover:bg-cyan-500 text-white font-semibold text-xs h-9"
                >
                  <Play className="w-3.5 h-3.5 mr-1" />
                  Evaluate Policy Access
                </Button>
              </form>

              {simResult && (
                <div className={`p-4 rounded-xl border space-y-2 ${
                  simResult.allowed
                    ? "bg-emerald-950/20 border-emerald-500/30 text-emerald-300"
                    : "bg-rose-950/20 border-rose-500/30 text-rose-300"
                }`}>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider flex items-center gap-1.5">
                      {simResult.allowed ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <AlertTriangle className="w-4 h-4 text-rose-400" />}
                      Result: {simResult.allowed ? "ALLOWED" : "DENIED"}
                    </span>
                    {simResult.requiresProductionConfirmation && (
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                        EXTRA CONFIRMATION REQUIRED
                      </span>
                    )}
                  </div>

                  <p className="text-xs text-white font-mono">{simResult.safeExplanation}</p>
                  <p className="text-[11px] text-zinc-400">Reason: {simResult.reason}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: DYNAMIC DATABASE CREDENTIALS */}
      {/* ========================================================================= */}
      {activeTab === "dynamic" && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 rounded-xl bg-zinc-900/60 border border-zinc-800/80 backdrop-blur-md">
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Database className="w-5 h-5 text-cyan-400" />
                Dynamic Leased Database Credentials
              </h3>
              <p className="text-xs text-zinc-400 mt-0.5">
                Generate short-lived, just-in-time database credentials with automated lease expiration and revocation.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Generate Form */}
            <form onSubmit={handleGenerateDynamicDb} className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5 space-y-4 backdrop-blur-md">
              <h4 className="text-sm font-bold text-white flex items-center gap-2 border-b border-zinc-800 pb-3">
                <Sparkles className="w-4 h-4 text-cyan-400" />
                Generate Leased Credential
              </h4>

              <div className="space-y-3">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-zinc-300">Database Engine</label>
                  <select
                    value={dynamicEngine}
                    onChange={(e) => setDynamicEngine(e.target.value as typeof dynamicEngine)}
                    className="w-full h-9 rounded-lg bg-zinc-950 border border-zinc-800 px-3 text-xs text-zinc-200 font-semibold focus:outline-none"
                  >
                    <option value="postgres">PostgreSQL</option>
                    <option value="mysql">MySQL</option>
                    <option value="mongodb">MongoDB</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-zinc-300">Role / Permission</label>
                  <Input
                    value={dynamicRole}
                    onChange={(e) => setDynamicRole(e.target.value)}
                    placeholder="readonly"
                    className="bg-zinc-950 border-zinc-800 text-xs text-white"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-zinc-300">TTL (Seconds)</label>
                  <Input
                    type="number"
                    value={dynamicTtl}
                    onChange={(e) => setDynamicTtl(Number(e.target.value))}
                    min={60}
                    max={86400}
                    className="bg-zinc-950 border-zinc-800 text-xs text-white"
                  />
                </div>

                <Button
                  type="submit"
                  disabled={isGeneratingDynamic}
                  className="w-full bg-cyan-600 hover:bg-cyan-500 text-white font-semibold text-xs h-9"
                >
                  Generate Credentials
                </Button>
              </div>
            </form>

            {/* Active Leases */}
            <div className="lg:col-span-2 rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5 backdrop-blur-md space-y-4">
              <h4 className="text-sm font-bold text-white flex items-center gap-2 border-b border-zinc-800 pb-3">
                <Zap className="w-4 h-4 text-amber-400" />
                Active Database Leases ({dynamicLeases.length})
              </h4>

              <div className="space-y-3">
                {dynamicLeases.length === 0 ? (
                  <p className="py-8 text-center text-xs text-zinc-500">No active dynamic credentials generated yet.</p>
                ) : (
                  dynamicLeases.map((l) => (
                    <div
                      key={l.leaseId}
                      className="rounded-xl bg-zinc-950 p-4 border border-zinc-850 space-y-3 font-mono text-xs"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-cyan-500/20 text-cyan-400">
                            {l.engine}
                          </span>
                          <span className="text-white font-bold">{l.username}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            onClick={() => handleRevokeDynamicLease(l.leaseId)}
                            className="bg-rose-600 hover:bg-rose-500 text-white text-[11px] h-7 px-2.5"
                          >
                            Revoke Lease
                          </Button>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-[11px] text-zinc-400 pt-2 border-t border-zinc-850">
                        <div>
                          <span className="text-zinc-500">Password:</span> <span className="text-amber-300 font-bold">{l.password}</span>
                        </div>
                        <div className="text-right">
                          <span className="text-zinc-500">Expires:</span> {new Date(l.expiresAt).toLocaleTimeString()}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 4: TRANSIT CRYPTOGRAPHY */}
      {/* ========================================================================= */}
      {activeTab === "transit" && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 rounded-xl bg-zinc-900/60 border border-zinc-800/80 backdrop-blur-md">
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Binary className="w-5 h-5 text-cyan-400" />
                Transit Encryption Engine (Encryption-as-a-Service)
              </h3>
              <p className="text-xs text-zinc-400 mt-0.5">
                Perform hardware-accelerated AES-256-GCM encryption without ever exposing raw cryptographic keys.
              </p>
            </div>

            <Button
              onClick={handleRotateTransitKey}
              variant="outline"
              className="text-xs h-8 gap-1.5 border-zinc-700 text-zinc-300"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Rotate Key (Current: v{transitKeyVersion})
            </Button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Encrypt Workbench */}
            <form onSubmit={handleTransitEncrypt} className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5 space-y-4 backdrop-blur-md">
              <h4 className="text-sm font-bold text-white border-b border-zinc-800 pb-3">Encrypt Plaintext</h4>

              <div className="space-y-3">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-zinc-300">Key Name</label>
                  <Input
                    value={transitKeyName}
                    onChange={(e) => setTransitKeyName(e.target.value)}
                    className="bg-zinc-950 border-zinc-800 font-mono text-xs text-white"
                    required
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-zinc-300">Plaintext</label>
                  <textarea
                    rows={3}
                    value={transitPlaintext}
                    onChange={(e) => setTransitPlaintext(e.target.value)}
                    className="w-full rounded-xl bg-zinc-950 border border-zinc-800 p-2.5 font-mono text-xs text-white focus:outline-none"
                    required
                  />
                </div>

                <Button type="submit" className="w-full bg-cyan-600 hover:bg-cyan-500 text-white font-semibold text-xs h-9">
                  Encrypt Data
                </Button>
              </div>

              {transitCiphertext && (
                <div className="p-3 rounded-xl bg-zinc-950 border border-zinc-850 space-y-1 font-mono text-xs">
                  <span className="text-[10px] text-cyan-400 font-bold uppercase">Transit Ciphertext:</span>
                  <p className="text-zinc-300 break-all">{transitCiphertext}</p>
                </div>
              )}
            </form>

            {/* Decrypt Workbench */}
            <form onSubmit={handleTransitDecrypt} className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5 space-y-4 backdrop-blur-md">
              <h4 className="text-sm font-bold text-white border-b border-zinc-800 pb-3">Decrypt Ciphertext</h4>

              <div className="space-y-3">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-zinc-300">Transit Ciphertext</label>
                  <textarea
                    rows={3}
                    value={transitCiphertext}
                    onChange={(e) => setTransitCiphertext(e.target.value)}
                    placeholder="vault:v1:..."
                    className="w-full rounded-xl bg-zinc-950 border border-zinc-800 p-2.5 font-mono text-xs text-white focus:outline-none"
                    required
                  />
                </div>

                <Button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs h-9">
                  Decrypt Ciphertext
                </Button>
              </div>

              {transitDecryptedText && (
                <div className="p-3 rounded-xl bg-emerald-950/20 border border-emerald-500/30 space-y-1 font-mono text-xs">
                  <span className="text-[10px] text-emerald-400 font-bold uppercase">Decrypted Plaintext:</span>
                  <p className="text-white">{transitDecryptedText}</p>
                </div>
              )}
            </form>
          </div>
        </div>
      )}

      {/* Secret Detail Drawer */}
      {activeSecret !== null && (
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
      )}

      {/* Create Policy Modal */}
      {isCreatingPolicy && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg rounded-2xl border border-zinc-800 bg-zinc-900 p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-cyan-400" />
                Create Vault Policy
              </h3>
              <button onClick={() => setIsCreatingPolicy(false)} className="text-zinc-500 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreatePolicy} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-zinc-300">Policy Name</label>
                <Input
                  value={newPolicyName}
                  onChange={(e) => setNewPolicyName(e.target.value)}
                  placeholder="e.g. analytics-service-policy"
                  className="bg-zinc-950 border-zinc-800 font-mono text-xs text-white"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-zinc-300">Description</label>
                <Input
                  value={newPolicyDesc}
                  onChange={(e) => setNewPolicyDesc(e.target.value)}
                  placeholder="Access to staging and runtime variables"
                  className="bg-zinc-950 border-zinc-800 text-xs text-white"
                />
              </div>

              <div className="space-y-2 border-t border-zinc-800 pt-3">
                <label className="text-xs font-semibold text-zinc-300">Rules (Path & Capabilities)</label>
                <div className="flex gap-2">
                  <Input
                    value={newRulePath}
                    onChange={(e) => setNewRulePath(e.target.value)}
                    placeholder="secret/data/staging/*"
                    className="bg-zinc-950 border-zinc-800 font-mono text-xs text-white flex-1"
                  />
                  <select
                    value={newRuleCap}
                    onChange={(e) => setNewRuleCap(e.target.value as VaultCapability)}
                    className="h-9 rounded-lg bg-zinc-950 border border-zinc-800 text-xs text-zinc-200 px-2 uppercase font-semibold focus:outline-none"
                  >
                    <option value="read">READ</option>
                    <option value="create">CREATE</option>
                    <option value="update">UPDATE</option>
                    <option value="delete">DELETE</option>
                    <option value="list">LIST</option>
                    <option value="deny">DENY</option>
                    <option value="sudo">SUDO</option>
                  </select>
                  <Button
                    type="button"
                    onClick={() => {
                      if (newRulePath.trim()) {
                        setNewPolicyRules([...newPolicyRules, { path: newRulePath.trim(), capabilities: [newRuleCap] }]);
                        setNewRulePath("");
                      }
                    }}
                    className="bg-zinc-800 hover:bg-zinc-700 text-xs"
                  >
                    Add
                  </Button>
                </div>

                <div className="space-y-1 max-h-28 overflow-y-auto">
                  {newPolicyRules.map((r, idx) => (
                    <div key={idx} className="flex items-center justify-between p-2 rounded bg-zinc-950 text-xs font-mono">
                      <span className="text-zinc-300">{r.path}</span>
                      <div className="flex items-center gap-2">
                        <span className="px-1.5 py-0.2 rounded text-[10px] bg-zinc-800 text-zinc-300 uppercase">
                          {r.capabilities.join(", ")}
                        </span>
                        <button
                          type="button"
                          onClick={() => setNewPolicyRules(newPolicyRules.filter((_, i) => i !== idx))}
                          className="text-zinc-500 hover:text-rose-400"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-zinc-800">
                <Button type="button" onClick={() => setIsCreatingPolicy(false)} className="bg-zinc-800 text-xs">
                  Cancel
                </Button>
                <Button type="submit" className="bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold">
                  Create Policy
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Soft Delete Confirm Modal */}
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
    <section className="fixed inset-x-3 bottom-3 z-40 mx-auto max-h-[calc(100vh-1.5rem)] max-w-2xl overflow-y-auto rounded-2xl border border-zinc-800 bg-zinc-900/95 p-6 shadow-2xl backdrop-blur-xl sm:inset-x-4 sm:bottom-4">
      <div className="flex items-start justify-between gap-3 border-b border-zinc-800 pb-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-cyan-400">
            Encrypted Secret Inspection & Versions
          </p>
          <h2 className="mt-1 font-mono text-base font-bold text-white">
            {secret.environment}/{secret.key}
          </h2>
        </div>
        <Button
          aria-label="Close reveal panel"
          className="h-8 w-8 px-0 bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white"
          onClick={onClose}
          type="button"
          variant="outline"
        >
          <EyeOff className="h-4 w-4" />
        </Button>
      </div>

      <dl className="mt-4 grid gap-2 rounded-xl border border-zinc-800 bg-zinc-950 p-3 text-xs md:grid-cols-2">
        <SecretDetail label="Created by" value={secret.createdBy ?? "system"} />
        <SecretDetail label="Updated by" value={secret.updatedBy ?? "system"} />
        <SecretDetail label="Created" value={formatRelativeTime(secret.createdAt)} />
        <SecretDetail label="Updated" value={formatRelativeTime(secret.updatedAt)} />
      </dl>

      <div className="mt-4 flex gap-2">
        <Input
          className="bg-zinc-950 border-zinc-800 text-xs text-white"
          onChange={(event) => setVaultPassword(event.target.value)}
          placeholder="Vault session password"
          type="password"
          value={vaultPassword}
        />
        <Button className="bg-cyan-600 hover:bg-cyan-500 text-white font-semibold text-xs" onClick={onReveal} type="button">
          <Eye className="h-4 w-4 mr-1" />
          Reveal Value
        </Button>
      </div>

      {revealedSecret !== null ? (
        <div className="mt-4 rounded-xl border border-emerald-500/40 bg-emerald-950/20 p-3.5 space-y-2">
          <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-400">
            Revealed Secret Value:
          </p>
          <div className="flex items-center justify-between gap-3">
            <p className="break-all font-mono text-sm font-bold text-white">{revealedSecret.value}</p>
            <Button
              className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs h-8 px-2.5"
              onClick={() => void onCopy(revealedSecret.value)}
              type="button"
            >
              <Clipboard className="h-3.5 w-3.5 mr-1" />
              Copy
            </Button>
          </div>
        </div>
      ) : null}

      <div className="mt-4 border-t border-zinc-800 pt-4">
        <p className="text-xs font-bold uppercase tracking-wider text-zinc-400">
          KV Version History ({versions.length})
        </p>
        <div className="mt-2 space-y-2 max-h-44 overflow-y-auto">
          {versions.length === 0 ? (
            <p className="text-xs text-zinc-500 italic">No previous versions recorded.</p>
          ) : (
            versions.map((version) => (
              <div
                className="flex items-center justify-between p-2 rounded-lg bg-zinc-950 border border-zinc-850 font-mono text-xs"
                key={`${version.version}:${version.occurredAt}`}
              >
                <span className="font-bold text-cyan-400">v{version.version}</span>
                <span className="text-zinc-400">
                  {version.status} by {version.actorId ?? "system"}
                </span>
                <span className="text-zinc-500 text-[11px]">
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
      <dt className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">{label}</dt>
      <dd className="mt-0.5 truncate font-mono text-white">{value}</dd>
    </div>
  );
}

function Summary({ label, value }: { readonly label: string; readonly value: number | string }) {
  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4 backdrop-blur-md">
      <p className="text-xs font-semibold text-zinc-400">{label}</p>
      <p className="mt-2 text-2xl font-bold tabular-nums text-white">{value}</p>
    </div>
  );
}

function upsertAuditEvent(events: VaultAuditEvent[], incoming: VaultAuditEvent): VaultAuditEvent[] {
  const eventsById = new Map<string, VaultAuditEvent>();
  for (const event of [incoming, ...events]) {
    eventsById.set(event.id, event);
  }
  return [...eventsById.values()].sort(
    (left, right) => Date.parse(right.occurredAt) - Date.parse(left.occurredAt),
  );
}

export default VaultPage;
