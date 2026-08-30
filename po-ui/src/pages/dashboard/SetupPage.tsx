import {
  Activity,
  Boxes,
  Check,
  CheckCircle2,
  ChevronRight,
  Clock,
  Cloud,
  Code2,
  Copy,
  Flame,
  KeyRound,
  Loader2,
  Plus,
  RadioTower,
  RefreshCw,
  Send,
  Server,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Terminal,
  Zap,
} from "lucide-react";
import { type FormEvent, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { createApiKey, createProject, type CreatedApiKey, type Project } from "@/features/auth/api";
import { getIngestionStats, type IngestionStats } from "@/features/dashboards/api";
import {
  ingestError,
  ingestLog,
  ingestMetric,
  type IngestedEventAck,
} from "@/features/ingestion/api";
import { apiClient, getApiErrorMessage } from "@/lib/api-client";
import { useDashboardContext } from "./DashboardLayout";

type PackageManager = "pnpm" | "npm" | "yarn" | "bun";
type FrameworkTab =
  | "express"
  | "fastify"
  | "jobs"
  | "docker"
  | "lambda"
  | "render"
  | "railway"
  | "fly"
  | "curl";

const defaultScopes = ["logs:write", "errors:write", "metrics:write"] as const;

export function SetupPage() {
  const { projects, refreshProjects, selectedEnvironment, selectedProject, selectedTimeRange } =
    useDashboardContext();
  const { notify } = useToast();

  const [projectName, setProjectName] = useState(projects.length === 0 ? "Production API" : "");
  const [projectSlug, setProjectSlug] = useState(projects.length === 0 ? "production-api" : "");
  const [keyName, setKeyName] = useState("local-sdk-key");
  const [createdProject, setCreatedProject] = useState<Project | null>(null);
  const [createdKey, setCreatedKey] = useState<CreatedApiKey | null>(null);
  const [lastAck, setLastAck] = useState<IngestedEventAck | null>(null);
  const [ingestionStats, setIngestionStats] = useState<IngestionStats | null>(null);
  const [isCreatingProject, setIsCreatingProject] = useState(false);
  const [isCreatingKey, setIsCreatingKey] = useState(false);
  const [isSendingTest, setIsSendingTest] = useState(false);
  const [isCheckingHeartbeat, setIsCheckingHeartbeat] = useState(false);
  const [copiedSection, setCopiedSection] = useState<string | null>(null);

  // Tabs
  const [packageManager, setPackageManager] = useState<PackageManager>("pnpm");
  const [frameworkTab, setFrameworkTab] = useState<FrameworkTab>("express");
  const [serviceNameInput, setServiceNameInput] = useState("checkout-api");

  const targetProject = createdProject ?? selectedProject;
  const apiBaseUrl = String(apiClient.defaults.baseURL ?? "http://localhost:4000");
  const rawApiKey = createdKey?.rawKey ?? "po_live_xxxxxxxxxxxxxxxxxxxxxxxx";

  const copyToClipboard = (text: string, sectionId: string) => {
    navigator.clipboard.writeText(text);
    setCopiedSection(sectionId);
    notify({
      variant: "success",
      title: "Copied to Clipboard",
      description: "Code snippet copied.",
    });
    setTimeout(() => {
      setCopiedSection((curr) => (curr === sectionId ? null : curr));
    }, 2000);
  };

  const loadIngestionStats = async () => {
    if (!targetProject) return;
    try {
      setIsCheckingHeartbeat(true);
      const stats = await getIngestionStats(targetProject.id, {
        environment: selectedEnvironment,
        timeRange: selectedTimeRange,
      });
      setIngestionStats(stats);
    } catch {
      // ignore
    } finally {
      setIsCheckingHeartbeat(false);
    }
  };

  useEffect(() => {
    if (targetProject === null) {
      setIngestionStats(null);
      return;
    }
    loadIngestionStats();
    const interval = setInterval(loadIngestionStats, 5000);
    return () => clearInterval(interval);
  }, [selectedEnvironment, selectedTimeRange, targetProject?.id]);

  const handleCreateProject = async (e: FormEvent) => {
    e.preventDefault();
    if (!projectName.trim() || !projectSlug.trim()) return;

    setIsCreatingProject(true);
    try {
      const project = await createProject({
        name: projectName.trim(),
        slug: projectSlug.trim().toLowerCase(),
      });
      setCreatedProject(project);
      await refreshProjects();
      notify({
        variant: "success",
        title: "Project Initialized",
        description: `Project "${project.name}" ready for SDK integration.`,
      });
    } catch (err) {
      notify({
        variant: "error",
        title: "Failed to Create Project",
        description: getApiErrorMessage(err),
      });
    } finally {
      setIsCreatingProject(false);
    }
  };

  const handleCreateKey = async (e: FormEvent) => {
    e.preventDefault();
    if (!targetProject) return;

    setIsCreatingKey(true);
    try {
      const key = await createApiKey(targetProject.id, {
        name: keyName.trim() || "sdk-key",
        scopes: [...defaultScopes],
      });
      setCreatedKey(key);
      notify({
        variant: "success",
        title: "Ingestion Key Created",
        description: "Copy and configure your API key in your environment.",
      });
    } catch (err) {
      notify({
        variant: "error",
        title: "Failed to Create Key",
        description: getApiErrorMessage(err),
      });
    } finally {
      setIsCreatingKey(false);
    }
  };

  const handleSendTestEvent = async (type: "log" | "metric" | "error") => {
    if (!targetProject) {
      notify({
        variant: "error",
        title: "No Project Selected",
        description: "Select or initialize a project first.",
      });
      return;
    }

    setIsSendingTest(true);
    try {
      const effectiveApiKey = createdKey?.rawKey ?? "demo_ingestion_api_key";
      const headers = { apiKey: effectiveApiKey };
      let ack: IngestedEventAck;

      if (type === "log") {
        ack = await ingestLog(headers, {
          source: serviceNameInput,
          level: "info",
          message: `Pulse check verified for ${serviceNameInput}`,
          attributes: {
            environment: selectedEnvironment,
            initiatedFrom: "setup-wizard",
            sdkVersion: "0.1.0",
          },
        });
      } else if (type === "metric") {
        ack = await ingestMetric(headers, {
          source: serviceNameInput,
          name: "sdk_heartbeat_latency_ms",
          value: Math.floor(Math.random() * 45) + 12,
          unit: "ms",
          attributes: {
            environment: selectedEnvironment,
            nodeVersion: "v22.0.0",
          },
        });
      } else {
        ack = await ingestError(headers, {
          source: serviceNameInput,
          name: "SetupWizardSimulatedError",
          message: "Simulated test exception from PulseOps Setup Wizard",
          stack: "Error: Simulated exception\n    at SetupPage.tsx:182:19",
          attributes: {
            environment: selectedEnvironment,
            isSimulated: true,
          },
        });
      }

      setLastAck(ack);
      notify({
        variant: "success",
        title: `Test ${type.toUpperCase()} Accepted`,
        description: `Event ID: ${ack.id.slice(0, 12)}...`,
      });
      setTimeout(loadIngestionStats, 800);
    } catch (err) {
      notify({
        variant: "error",
        title: "Ingestion Test Failed",
        description: getApiErrorMessage(err),
      });
    } finally {
      setIsSendingTest(false);
    }
  };

  const installCommand = useMemo(() => {
    switch (packageManager) {
      case "pnpm":
        return "pnpm add @pulseops/node-sdk";
      case "npm":
        return "npm install @pulseops/node-sdk";
      case "yarn":
        return "yarn add @pulseops/node-sdk";
      case "bun":
        return "bun add @pulseops/node-sdk";
    }
  }, [packageManager]);

  const frameworkSnippets = useMemo<Record<FrameworkTab, { title: string; code: string; lang: string }>>(
    () => ({
      express: {
        title: "Express.js Instrumentation",
        lang: "typescript",
        code: `import express from "express";
import {
  initPulseOps,
  createPulseOpsMiddleware,
  createPulseOpsErrorHandler,
} from "@pulseops/node-sdk";

const app = express();

// 1. Initialize SDK
const pulseOps = initPulseOps({
  apiKey: process.env.PULSEOPS_API_KEY || "${rawApiKey}",
  endpoint: process.env.PULSEOPS_ENDPOINT || "${apiBaseUrl}",
  serviceName: "${serviceNameInput}",
  environment: process.env.NODE_ENV || "${selectedEnvironment}",
});

// 2. Attach request duration & latency metric middleware
app.use(createPulseOpsMiddleware(pulseOps));

// Your routes
app.get("/api/checkout", (req, res) => {
  pulseOps.info("Processing checkout", { customer: "alice" });
  pulseOps.increment("orders_total", 1);
  res.json({ success: true });
});

// 3. Attach error capture handler before server listen
app.use(createPulseOpsErrorHandler(pulseOps));

app.listen(3000, () => console.log("Server running with PulseOps"));`,
      },
      fastify: {
        title: "Fastify / Standalone Node.js",
        lang: "typescript",
        code: `import Fastify from "fastify";
import { initPulseOps } from "@pulseops/node-sdk";

const pulseOps = initPulseOps({
  apiKey: process.env.PULSEOPS_API_KEY || "${rawApiKey}",
  endpoint: "${apiBaseUrl}",
  serviceName: "${serviceNameInput}",
  environment: "${selectedEnvironment}",
});

const fastify = Fastify();

fastify.addHook("onResponse", async (request, reply) => {
  pulseOps.log(
    reply.statusCode >= 500 ? "error" : "info",
    \`HTTP \${request.method} \${request.url} \${reply.statusCode}\`,
    {
      method: request.method,
      url: request.url,
      statusCode: reply.statusCode,
      durationMs: reply.elapsedTime,
    }
  );
  pulseOps.timing("http_request_duration_ms", reply.elapsedTime, {
    method: request.method,
    route: request.routeOptions.url,
  });
});

fastify.setErrorHandler((error, request, reply) => {
  pulseOps.error(error, { url: request.url, method: request.method });
  reply.send(error);
});`,
      },
      jobs: {
        title: "Background Worker & Queue Instrumentation",
        lang: "typescript",
        code: `import { getPulseOpsClient, instrumentJob } from "@pulseops/node-sdk";

const pulseOps = getPulseOpsClient();

// Wrap background queue consumers (BullMQ, RabbitMQ, Cron)
export async function processInvoiceJob(jobData: { invoiceId: string }) {
  return await instrumentJob(
    pulseOps!,
    "process_invoice",
    async () => {
      // Your job business logic
      console.log("Generating invoice for:", jobData.invoiceId);
      await generatePdf(jobData.invoiceId);
      return { success: true };
    },
    {
      queueName: "billing-invoices",
      attributes: { invoiceId: jobData.invoiceId },
    }
  );
}`,
      },
      docker: {
        title: "Docker & Docker Compose Configuration",
        lang: "yaml",
        code: `# compose.yaml
services:
  ${serviceNameInput}:
    build: .
    environment:
      - NODE_ENV=${selectedEnvironment}
      - SERVICE_NAME=${serviceNameInput}
      - PULSEOPS_ENDPOINT=${apiBaseUrl}
      - PULSEOPS_API_KEY=${rawApiKey}
    ports:
      - "3000:3000"`,
      },
      lambda: {
        title: "AWS Lambda / Serverless Handler",
        lang: "typescript",
        code: `import { initPulseOps } from "@pulseops/node-sdk";

const pulseOps = initPulseOps({
  apiKey: process.env.PULSEOPS_API_KEY || "${rawApiKey}",
  endpoint: "${apiBaseUrl}",
  serviceName: "${serviceNameInput}",
  environment: "${selectedEnvironment}",
});

export const handler = async (event: any, context: any) => {
  const start = Date.now();
  try {
    pulseOps.info("Lambda invocation started", { requestId: context.awsRequestId });
    
    // Handler execution logic...
    const result = { statusCode: 200, body: JSON.stringify({ message: "Hello" }) };

    pulseOps.timing("lambda_duration_ms", Date.now() - start, { function: context.functionName });
    return result;
  } catch (err) {
    pulseOps.error(err, { requestId: context.awsRequestId });
    throw err;
  } finally {
    // Explicitly flush event buffer before Lambda freezes execution container
    await pulseOps.flush();
  }
};`,
      },
      render: {
        title: "Render.com Environment Setup",
        lang: "bash",
        code: `# In Render Dashboard -> Environment -> Environment Variables:
PULSEOPS_API_KEY=${rawApiKey}
PULSEOPS_ENDPOINT=${apiBaseUrl}
SERVICE_NAME=${serviceNameInput}
NODE_ENV=${selectedEnvironment}`,
      },
      railway: {
        title: "Railway.app Setup",
        lang: "bash",
        code: `# In Railway -> Variables:
PULSEOPS_API_KEY=${rawApiKey}
PULSEOPS_ENDPOINT=${apiBaseUrl}
SERVICE_NAME=${serviceNameInput}
NODE_ENV=${selectedEnvironment}`,
      },
      fly: {
        title: "Fly.io (fly.toml)",
        lang: "toml",
        code: `# fly.toml
[env]
  SERVICE_NAME = "${serviceNameInput}"
  PULSEOPS_ENDPOINT = "${apiBaseUrl}"
  NODE_ENV = "${selectedEnvironment}"

# Set sensitive API key as a secret:
# flyctl secrets set PULSEOPS_API_KEY="${rawApiKey}"`,
      },
      curl: {
        title: "Direct Ingestion via cURL / Raw HTTP",
        lang: "bash",
        code: `# Send Log
curl -X POST ${apiBaseUrl}/ingest/logs \\
  -H "content-type: application/json" \\
  -H "x-api-key: ${rawApiKey}" \\
  -d '{"source":"${serviceNameInput}","level":"info","message":"Pulse check connected","attributes":{"environment":"${selectedEnvironment}"}}'

# Send Metric
curl -X POST ${apiBaseUrl}/ingest/metrics \\
  -H "content-type: application/json" \\
  -H "x-api-key: ${rawApiKey}" \\
  -d '{"source":"${serviceNameInput}","name":"request_duration_ms","value":42,"unit":"ms"}'

# Send Error
curl -X POST ${apiBaseUrl}/ingest/errors \\
  -H "content-type: application/json" \\
  -H "x-api-key: ${rawApiKey}" \\
  -d '{"source":"${serviceNameInput}","level":"error","message":"Database timeout","stack":"Error: Timeout\\n at db.js:10"}'`,
      },
    }),
    [apiBaseUrl, rawApiKey, selectedEnvironment, serviceNameInput],
  );

  const hasReceivedEvents = (ingestionStats?.acceptedEvents ?? 0) > 0;

  return (
    <div className="space-y-8 pb-16">
      {/* Page Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-tr from-cyan-500/20 to-indigo-500/20 text-cyan-400 border border-cyan-500/30">
              <Code2 className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold tracking-tight text-white">
                  Agents, SDKs & Instrumentation
                </h1>
                <span className="rounded-full bg-cyan-500/10 px-2.5 py-0.5 text-xs font-semibold text-cyan-400 border border-cyan-500/20">
                  v0.1.0
                </span>
              </div>
              <p className="text-sm text-zinc-400">
                Connect your backend microservices, background jobs, and containers to PulseOps with
                high-throughput non-blocking telemetry.
              </p>
            </div>
          </div>
        </div>

        {targetProject && (
          <div className="flex items-center gap-2 rounded-xl bg-zinc-900/80 p-2 border border-zinc-800 backdrop-blur-md">
            <span className="text-xs text-zinc-400 pl-2">Active Target:</span>
            <span className="rounded-lg bg-zinc-800 px-2.5 py-1 text-xs font-semibold text-white">
              {targetProject.name}
            </span>
            <span className="rounded-lg bg-cyan-500/10 px-2.5 py-1 text-xs font-semibold text-cyan-400 border border-cyan-500/20">
              {selectedEnvironment}
            </span>
          </div>
        )}
      </div>

      {/* Project & Key Setup Banner (if missing) */}
      {!targetProject && (
        <div className="rounded-2xl border border-indigo-500/30 bg-gradient-to-b from-indigo-950/20 to-zinc-950/60 p-6 shadow-xl backdrop-blur-md">
          <div className="flex items-start gap-4">
            <div className="rounded-xl bg-indigo-500/10 p-3 text-indigo-400 border border-indigo-500/20">
              <Sparkles className="h-6 w-6" />
            </div>
            <div className="flex-1 space-y-3">
              <h2 className="text-lg font-bold text-white">Initialize Your First Project</h2>
              <p className="text-sm text-zinc-300">
                Create a project to obtain an ingestion API key and start streaming logs, metrics,
                and exceptions.
              </p>
              <form
                onSubmit={handleCreateProject}
                className="grid grid-cols-1 gap-3 sm:grid-cols-3 max-w-xl"
              >
                <Input
                  value={projectName}
                  onChange={(e) => {
                    setProjectName(e.target.value);
                    setProjectSlug(
                      e.target.value
                        .toLowerCase()
                        .replace(/[^a-z0-9]+/g, "-")
                        .replace(/(^-|-$)/g, ""),
                    );
                  }}
                  placeholder="Project Name"
                  className="bg-zinc-900/90 border-zinc-800 text-white"
                  required
                />
                <Input
                  value={projectSlug}
                  onChange={(e) => setProjectSlug(e.target.value)}
                  placeholder="project-slug"
                  className="bg-zinc-900/90 border-zinc-800 text-white font-mono text-xs"
                  required
                />
                <Button
                  type="submit"
                  disabled={isCreatingProject}
                  className="bg-cyan-500 text-black hover:bg-cyan-400 font-semibold"
                >
                  {isCreatingProject ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <Plus className="h-4 w-4 mr-2" />
                  )}
                  Create Project
                </Button>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Target Configuration & Key Bar */}
      {targetProject && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="rounded-2xl border border-zinc-800/80 bg-zinc-900/50 p-5 shadow-lg backdrop-blur-md space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                Ingestion Endpoint
              </span>
              <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
            </div>
            <div className="flex items-center justify-between rounded-xl bg-zinc-950/80 px-3.5 py-2.5 border border-zinc-800">
              <code className="text-xs font-mono text-cyan-300">{apiBaseUrl}</code>
              <button
                type="button"
                onClick={() => copyToClipboard(apiBaseUrl, "endpoint")}
                className="text-zinc-400 hover:text-white transition-colors"
              >
                {copiedSection === "endpoint" ? (
                  <Check className="h-4 w-4 text-emerald-400" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </button>
            </div>
          </div>

          <div className="rounded-2xl border border-zinc-800/80 bg-zinc-900/50 p-5 shadow-lg backdrop-blur-md space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                Service Identifier
              </span>
              <Boxes className="h-4 w-4 text-indigo-400" />
            </div>
            <Input
              value={serviceNameInput}
              onChange={(e) => setServiceNameInput(e.target.value.toLowerCase().trim())}
              placeholder="e.g. checkout-api"
              className="bg-zinc-950/80 border-zinc-800 text-white font-mono text-xs"
            />
          </div>

          <div className="rounded-2xl border border-zinc-800/80 bg-zinc-900/50 p-5 shadow-lg backdrop-blur-md space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                Ingestion API Key
              </span>
              <KeyRound className="h-4 w-4 text-amber-400" />
            </div>
            {createdKey ? (
              <div className="flex items-center justify-between rounded-xl bg-zinc-950/80 px-3.5 py-2 border border-emerald-500/30">
                <code className="text-xs font-mono text-emerald-300 truncate mr-2">
                  {createdKey.rawKey}
                </code>
                <button
                  type="button"
                  onClick={() => copyToClipboard(createdKey.rawKey, "apikey")}
                  className="text-zinc-400 hover:text-white transition-colors flex-shrink-0"
                >
                  {copiedSection === "apikey" ? (
                    <Check className="h-4 w-4 text-emerald-400" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </button>
              </div>
            ) : (
              <form onSubmit={handleCreateKey} className="flex gap-2">
                <Input
                  value={keyName}
                  onChange={(e) => setKeyName(e.target.value)}
                  placeholder="Key label"
                  className="bg-zinc-950/80 border-zinc-800 text-white text-xs"
                />
                <Button
                  type="submit"
                  disabled={isCreatingKey}
                  className="bg-amber-500 hover:bg-amber-400 text-black font-semibold text-xs whitespace-nowrap h-9 px-3"
                >
                  {isCreatingKey ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Generate"}
                </Button>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Main Grid: Code Snippets (Left 2 cols) & Live Pulse Verifier (Right 1 col) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left 2 Cols: Installation & Code Snippets */}
        <div className="lg:col-span-2 space-y-6">
          {/* Quick Install Bar */}
          <div className="rounded-2xl border border-zinc-800/80 bg-zinc-900/40 p-6 shadow-xl backdrop-blur-md space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Terminal className="h-5 w-5 text-cyan-400" />
                <h2 className="text-base font-bold text-white">1. Install Node.js SDK</h2>
              </div>

              {/* Package Manager Selector */}
              <div className="flex rounded-xl bg-zinc-950 p-1 border border-zinc-800">
                {(["pnpm", "npm", "yarn", "bun"] as PackageManager[]).map((pm) => (
                  <button
                    key={pm}
                    type="button"
                    onClick={() => setPackageManager(pm)}
                    className={`rounded-lg px-3 py-1 text-xs font-semibold uppercase tracking-wider transition-all ${
                      packageManager === pm
                        ? "bg-cyan-500 text-black shadow-md"
                        : "text-zinc-400 hover:text-white"
                    }`}
                  >
                    {pm}
                  </button>
                ))}
              </div>
            </div>

            {/* Install Command Box */}
            <div className="flex items-center justify-between rounded-xl bg-zinc-950/90 px-4 py-3 border border-zinc-800/80">
              <div className="flex items-center gap-3">
                <span className="text-zinc-500 select-none">$</span>
                <code className="text-sm font-mono text-cyan-300">{installCommand}</code>
              </div>
              <button
                type="button"
                onClick={() => copyToClipboard(installCommand, "install")}
                className="flex items-center gap-1.5 rounded-lg bg-zinc-800 px-3 py-1.5 text-xs font-semibold text-zinc-300 hover:bg-zinc-700 hover:text-white transition-colors"
              >
                {copiedSection === "install" ? (
                  <>
                    <Check className="h-3.5 w-3.5 text-emerald-400" />
                    <span className="text-emerald-400">Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="h-3.5 w-3.5" />
                    <span>Copy</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Framework & Runtime Guides */}
          <div className="rounded-2xl border border-zinc-800/80 bg-zinc-900/40 p-6 shadow-xl backdrop-blur-md space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Code2 className="h-5 w-5 text-indigo-400" />
                <h2 className="text-base font-bold text-white">2. Instrument Your Application</h2>
              </div>
            </div>

            {/* Framework Tabs Pill List */}
            <div className="flex flex-wrap gap-1.5 rounded-xl bg-zinc-950/80 p-1.5 border border-zinc-800">
              {[
                { id: "express", label: "Express.js", icon: Server },
                { id: "fastify", label: "Fastify / Node", icon: Zap },
                { id: "jobs", label: "Queues / Jobs", icon: Clock },
                { id: "docker", label: "Docker", icon: Boxes },
                { id: "lambda", label: "AWS Lambda", icon: Flame },
                { id: "render", label: "Render", icon: Cloud },
                { id: "railway", label: "Railway", icon: Cloud },
                { id: "fly", label: "Fly.io", icon: Cloud },
                { id: "curl", label: "Raw cURL", icon: Terminal },
              ].map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setFrameworkTab(tab.id as FrameworkTab)}
                    className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
                      frameworkTab === tab.id
                        ? "bg-indigo-600 text-white shadow-md"
                        : "text-zinc-400 hover:text-white hover:bg-zinc-800/60"
                    }`}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {tab.label}
                  </button>
                );
              })}
            </div>

            {/* Code Box */}
            <div className="relative rounded-xl border border-zinc-800 bg-zinc-950/90 overflow-hidden">
              <div className="flex items-center justify-between border-b border-zinc-800/80 bg-zinc-900/60 px-4 py-2.5">
                <span className="text-xs font-semibold text-zinc-300">
                  {frameworkSnippets[frameworkTab].title}
                </span>
                <button
                  type="button"
                  onClick={() =>
                    copyToClipboard(
                      frameworkSnippets[frameworkTab].code,
                      `snippet_${frameworkTab}`,
                    )
                  }
                  className="flex items-center gap-1.5 text-xs text-zinc-400 hover:text-white transition-colors"
                >
                  {copiedSection === `snippet_${frameworkTab}` ? (
                    <>
                      <Check className="h-3.5 w-3.5 text-emerald-400" />
                      <span className="text-emerald-400">Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="h-3.5 w-3.5" />
                      <span>Copy Snippet</span>
                    </>
                  )}
                </button>
              </div>
              <pre className="p-4 text-xs font-mono text-zinc-200 overflow-x-auto leading-relaxed max-h-96">
                <code>{frameworkSnippets[frameworkTab].code}</code>
              </pre>
            </div>
          </div>

          {/* Key Rotation & Security Guide */}
          <div className="rounded-2xl border border-zinc-800/80 bg-zinc-900/40 p-6 shadow-xl backdrop-blur-md space-y-4">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-emerald-400" />
              <h2 className="text-base font-bold text-white">Zero-Downtime Key Rotation Guide</h2>
            </div>
            <p className="text-sm text-zinc-400">
              Follow these best practices to rotate ingestion credentials safely without dropping telemetry:
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2">
              <div className="rounded-xl border border-zinc-800/80 bg-zinc-950/50 p-4 space-y-1.5">
                <div className="flex items-center gap-2 text-cyan-400 font-semibold text-xs">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-cyan-500/10 border border-cyan-500/20 text-xs">
                    1
                  </span>
                  Generate New Key
                </div>
                <p className="text-xs text-zinc-400">
                  Create a second ingestion key in Project Settings while keeping the current key active.
                </p>
              </div>

              <div className="rounded-xl border border-zinc-800/80 bg-zinc-950/50 p-4 space-y-1.5">
                <div className="flex items-center gap-2 text-indigo-400 font-semibold text-xs">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-indigo-500/10 border border-indigo-500/20 text-xs">
                    2
                  </span>
                  Deploy Secret
                </div>
                <p className="text-xs text-zinc-400">
                  Update <code className="text-indigo-300">PULSEOPS_API_KEY</code> across production container environments.
                </p>
              </div>

              <div className="rounded-xl border border-zinc-800/80 bg-zinc-950/50 p-4 space-y-1.5">
                <div className="flex items-center gap-2 text-emerald-400 font-semibold text-xs">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500/10 border border-emerald-500/20 text-xs">
                    3
                  </span>
                  Revoke Old Key
                </div>
                <p className="text-xs text-zinc-400">
                  Once telemetry streams from the new key, revoke the old key to prevent unauthorized access.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Right 1 Col: Live "Verify Integration & Heartbeat Listener" */}
        <div className="space-y-6">
          <div className="rounded-2xl border border-cyan-500/30 bg-gradient-to-b from-cyan-950/20 via-zinc-900/60 to-zinc-950 p-6 shadow-2xl backdrop-blur-md space-y-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <RadioTower className="h-5 w-5 text-cyan-400 animate-pulse" />
                <h3 className="text-base font-bold text-white">Live Pulse Verifier</h3>
              </div>
              <button
                type="button"
                onClick={loadIngestionStats}
                disabled={isCheckingHeartbeat}
                className="text-zinc-400 hover:text-white transition-colors"
                title="Refresh Telemetry Heartbeat"
              >
                <RefreshCw
                  className={`h-4 w-4 ${isCheckingHeartbeat ? "animate-spin text-cyan-400" : ""}`}
                />
              </button>
            </div>

            {/* Radar / Heartbeat Visualizer */}
            <div className="relative flex flex-col items-center justify-center rounded-2xl border border-zinc-800 bg-zinc-950/80 p-8 text-center overflow-hidden">
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-20">
                <div className="h-48 w-48 rounded-full border border-cyan-500 animate-ping" />
                <div className="absolute h-32 w-32 rounded-full border border-cyan-400/50 animate-pulse" />
              </div>

              <div
                className={`relative flex h-16 w-16 items-center justify-center rounded-2xl shadow-xl transition-all ${
                  hasReceivedEvents
                    ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 shadow-emerald-500/10"
                    : "bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 shadow-cyan-500/10"
                }`}
              >
                {hasReceivedEvents ? (
                  <CheckCircle2 className="h-8 w-8" />
                ) : (
                  <Activity className="h-8 w-8 animate-pulse" />
                )}
              </div>

              <div className="mt-4 space-y-1 z-10">
                <h4 className="text-sm font-bold text-white">
                  {hasReceivedEvents ? "Telemetry Streaming Active" : "Listening for First Pulse..."}
                </h4>
                <p className="text-xs text-zinc-400 max-w-xs">
                  {hasReceivedEvents
                    ? `Received ${ingestionStats?.acceptedEvents} telemetry events for ${targetProject?.name}.`
                    : `Send events from service "${serviceNameInput}" to verify connection.`}
                </p>
              </div>

              {/* Live Metric Counters */}
              <div className="mt-6 grid grid-cols-3 gap-2 w-full pt-4 border-t border-zinc-800/80">
                <div className="text-center">
                  <div className="text-xs text-zinc-500">Accepted</div>
                  <div className="text-sm font-bold text-cyan-300">
                    {ingestionStats?.acceptedEvents ?? 0}
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-xs text-zinc-500">Processed</div>
                  <div className="text-sm font-bold text-indigo-300">
                    {ingestionStats?.processedEvents ?? 0}
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-xs text-zinc-500">Rejected</div>
                  <div className="text-sm font-bold text-rose-300">
                    {ingestionStats?.rejectedEvents ?? 0}
                  </div>
                </div>
              </div>
            </div>

            {/* Quick Test Ingestion Dispatcher */}
            <div className="space-y-3 pt-2">
              <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider block">
                Instant Event Dispatcher
              </span>
              <div className="grid grid-cols-3 gap-2">
                <Button
                  type="button"
                  onClick={() => handleSendTestEvent("log")}
                  disabled={isSendingTest}
                  className="bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 text-xs h-8 px-2"
                >
                  <Send className="h-3 w-3 mr-1" />
                  Test Log
                </Button>
                <Button
                  type="button"
                  onClick={() => handleSendTestEvent("metric")}
                  disabled={isSendingTest}
                  className="bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 text-xs h-8 px-2"
                >
                  <Activity className="h-3 w-3 mr-1" />
                  Test Metric
                </Button>
                <Button
                  type="button"
                  onClick={() => handleSendTestEvent("error")}
                  disabled={isSendingTest}
                  className="bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 text-xs h-8 px-2"
                >
                  <ShieldAlert className="h-3 w-3 mr-1" />
                  Test Error
                </Button>
              </div>
            </div>

            {/* Last Acknowledged Receipt */}
            {lastAck && (
              <div className="rounded-xl bg-zinc-950 p-3 border border-zinc-800 space-y-1">
                <div className="flex items-center justify-between text-xs text-zinc-400">
                  <span>Last Ingest Ack:</span>
                  <span className="font-mono text-emerald-400">{lastAck.type.toUpperCase()}</span>
                </div>
                <div className="text-[10px] font-mono text-zinc-500 truncate">
                  Event ID: {lastAck.id}
                </div>
              </div>
            )}

            {/* Deep Links to Dashboards */}
            <div className="pt-2 space-y-2 border-t border-zinc-800">
              <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider block">
                Explore Dashboards
              </span>
              <div className="grid grid-cols-2 gap-2">
                <Link
                  to="/dashboard/services"
                  className="flex items-center justify-between rounded-xl bg-zinc-900/60 p-2.5 text-xs font-medium text-zinc-300 hover:bg-zinc-800 hover:text-white transition-colors border border-zinc-800"
                >
                  <span>Service Catalog</span>
                  <ChevronRight className="h-3.5 w-3.5 text-zinc-500" />
                </Link>
                <Link
                  to="/dashboard/logs"
                  className="flex items-center justify-between rounded-xl bg-zinc-900/60 p-2.5 text-xs font-medium text-zinc-300 hover:bg-zinc-800 hover:text-white transition-colors border border-zinc-800"
                >
                  <span>Live Logs</span>
                  <ChevronRight className="h-3.5 w-3.5 text-zinc-500" />
                </Link>
                <Link
                  to="/dashboard/metrics"
                  className="flex items-center justify-between rounded-xl bg-zinc-900/60 p-2.5 text-xs font-medium text-zinc-300 hover:bg-zinc-800 hover:text-white transition-colors border border-zinc-800"
                >
                  <span>Metrics</span>
                  <ChevronRight className="h-3.5 w-3.5 text-zinc-500" />
                </Link>
                <Link
                  to="/dashboard/errors"
                  className="flex items-center justify-between rounded-xl bg-zinc-900/60 p-2.5 text-xs font-medium text-zinc-300 hover:bg-zinc-800 hover:text-white transition-colors border border-zinc-800"
                >
                  <span>Error Groups</span>
                  <ChevronRight className="h-3.5 w-3.5 text-zinc-500" />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
export default SetupPage;
