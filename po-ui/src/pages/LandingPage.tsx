import {
  Activity,
  ArrowRight,
  Boxes,
  CheckCircle2,
  Gauge,
  KeyRound,
  LockKeyhole,
  Menu,
  RadioTower,
  RotateCcw,
  ShieldCheck,
  Timer,
  Workflow,
  X,
  Zap,
} from "lucide-react";
import { lazy, Suspense, useState, type CSSProperties } from "react";
import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { useScrollReveal } from "@/hooks/useScrollReveal";

const ServiceTopologyScene = lazy(() =>
  import("@/features/landing/ServiceTopologyScene").then((module) => ({
    default: module.ServiceTopologyScene,
  })),
);

const mvpSignals = [
  { label: "events per project per minute", value: "600", tone: "text-cyan-700" },
  { label: "repeated errors in 5 minutes", value: "20", tone: "text-rose-700" },
  { label: "p95 latency warning threshold", value: "1000ms", tone: "text-amber-700" },
] as const;

const heroFlow = [
  ["HTTP", "API-key telemetry", RadioTower],
  ["Redis", "rate limits, idempotency, hot counters", Timer],
  ["RabbitMQ", "confirmed publish, retries, DLQ", Boxes],
  ["Workers", "persist events and evaluate incidents", Workflow],
  ["Realtime", "Socket.IO dashboard updates", Activity],
] as const;

const productPillars = [
  {
    icon: RadioTower,
    label: "Telemetry ingestion",
    title: "Applications send logs, errors, and metrics with a project API key.",
    text: "The ingestion service validates the key, applies Redis rate limits and idempotency, then returns 202 only after a RabbitMQ confirm publish.",
  },
  {
    icon: Boxes,
    label: "Queue-backed processing",
    title: "Workers turn accepted telemetry into durable operational data.",
    text: "RabbitMQ routes logs, errors, metrics, incident evaluation, audit events, realtime updates, retries, and dead-letter messages.",
  },
  {
    icon: Gauge,
    label: "Incident detection",
    title: "Repeated errors and high latency become actionable incidents.",
    text: "Redis counters and p95 latency windows trigger incident evaluation while dedupe locks prevent alert storms.",
  },
  {
    icon: LockKeyhole,
    label: "PulseOps Vault",
    title: "Project environment secrets are encrypted and audited.",
    text: "AES-256-GCM encrypted values, vault-password reveal, hashed integration tokens, and audit-safe logs prove secure handling.",
  },
] as const;

const demoPath = [
  [
    "1",
    "Create account and project",
    "A user signs in, creates a project, and selects an environment.",
  ],
  [
    "2",
    "Generate ingestion API key",
    "PulseOps returns the raw key once and stores only a hash plus safe prefix metadata.",
  ],
  [
    "3",
    "Send app telemetry",
    "External apps call logs, errors, and metrics endpoints with optional idempotency keys.",
  ],
  [
    "4",
    "Publish to RabbitMQ",
    "Ingestion validates fast, rate-limits with Redis, and publishes the event envelope.",
  ],
  [
    "5",
    "Process with workers",
    "Workers persist events, update hot Redis data, heartbeat status, and queue follow-up jobs.",
  ],
  [
    "6",
    "Detect incidents live",
    "Repeated errors or p95 latency thresholds create or update incidents in realtime.",
  ],
  [
    "7",
    "Manage Vault secrets",
    "Users store, reveal, rotate, and fetch encrypted environment variables with audit logs.",
  ],
] as const;

const dashboardSurfaces = [
  "events today",
  "logs per minute",
  "error rate",
  "avg latency",
  "p95 latency",
  "active incidents",
  "queue depth",
  "worker status",
  "vault audit activity",
] as const;

const securityControls = [
  {
    icon: KeyRound,
    title: "Raw credentials are one-time only",
    text: "API keys and vault integration tokens are returned once, then stored as hashes with safe prefixes.",
  },
  {
    icon: ShieldCheck,
    title: "Secrets are encrypted, not merely hidden",
    text: "Vault records store ciphertext, IV, auth tag, salt, KDF metadata, version, and audit-safe metadata.",
  },
  {
    icon: Timer,
    title: "Redis handles hot state with TTLs",
    text: "Rate limits, idempotency, summary caches, incident counters, token caches, and heartbeats expire intentionally.",
  },
  {
    icon: RotateCcw,
    title: "Retries have an end",
    text: "RabbitMQ retries use bounded delay queues, manual ack rules, poison message handling, and DLQ routing.",
  },
] as const;

export function LandingPage() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  useScrollReveal();

  return (
    <main className="landing-surface min-h-screen overflow-hidden bg-background text-foreground">
      <header className="fixed left-0 right-0 top-0 z-50 px-4 pt-4 sm:px-8">
        <nav className="mx-auto grid h-14 max-w-7xl grid-cols-[auto_1fr_auto] items-center gap-3">
          <Link className="flex min-w-0 items-center gap-3" to="/">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-zinc-950 text-sm font-black text-white shadow-sm">
              PO
            </span>
            <span className="hidden text-sm font-semibold tracking-normal text-zinc-950 sm:inline">
              PulseOps
            </span>
          </Link>
          <div className="mx-auto hidden h-12 items-center gap-2 rounded-full border bg-background/86 px-2 text-sm text-muted-foreground shadow-sm shadow-slate-200/70 backdrop-blur-xl md:flex">
            <a className="transition hover:text-foreground" href="#mvp">
              MVP
            </a>
            <a className="transition hover:text-foreground" href="#pipeline">
              Pipeline
            </a>
            <a className="transition hover:text-foreground" href="#security">
              Security
            </a>
            <a className="transition hover:text-foreground" href="#dashboard">
              Dashboard
            </a>
          </div>
          <div className="flex items-center justify-end gap-2">
            <Button
              asChild
              className="hidden w-auto bg-background/72 backdrop-blur-md sm:inline-flex"
              variant="ghost"
            >
              <Link to="/login">Sign in</Link>
            </Button>
            <Button asChild className="w-auto shadow-sm shadow-blue-600/20">
              <Link to="/register">
                Start demo
                <ArrowRight aria-hidden="true" className="h-4 w-4" />
              </Link>
            </Button>
            <Button
              aria-expanded={isMobileMenuOpen}
              aria-label={isMobileMenuOpen ? "Close navigation" : "Open navigation"}
              className="h-11 w-11 p-0 md:hidden"
              onClick={() => setIsMobileMenuOpen((current) => !current)}
              type="button"
              variant="outline"
            >
              {isMobileMenuOpen ? (
                <X aria-hidden="true" className="h-4 w-4" />
              ) : (
                <Menu aria-hidden="true" className="h-4 w-4" />
              )}
            </Button>
          </div>
        </nav>
        {isMobileMenuOpen ? (
          <div className="mx-auto mt-2 grid max-w-7xl gap-1 rounded-xl border bg-background/95 p-2 text-base shadow-lg backdrop-blur-xl md:hidden">
            {[
              ["MVP", "#mvp"],
              ["Pipeline", "#pipeline"],
              ["Security", "#security"],
              ["Dashboard", "#dashboard"],
            ].map(([label, href]) => (
              <a
                className="flex min-h-11 items-center rounded-lg px-3 font-medium text-muted-foreground transition hover:bg-secondary hover:text-foreground"
                href={href}
                key={href}
                onClick={() => setIsMobileMenuOpen(false)}
              >
                {label}
              </a>
            ))}
            <Link
              className="flex min-h-11 items-center rounded-lg px-3 font-medium text-muted-foreground transition hover:bg-secondary hover:text-foreground sm:hidden"
              onClick={() => setIsMobileMenuOpen(false)}
              to="/login"
            >
              Sign in
            </Link>
          </div>
        ) : null}
      </header>

      <section className="relative min-h-[86vh] overflow-hidden pt-16">
        <div className="hero-grid absolute inset-0" />
        <Suspense fallback={<div className="absolute inset-0" />}>
          <ServiceTopologyScene />
        </Suspense>
        <div className="relative z-10 mx-auto flex min-h-[calc(86vh-4rem)] max-w-7xl flex-col justify-center px-5 pb-8 pt-12 sm:px-8">
          <div className="max-w-4xl" data-reveal>
            <Badge className="mb-6 gap-2" variant="outline">
              <Activity aria-hidden="true" className="h-3.5 w-3.5 text-emerald-600" />
              Local-first developer operations platform
            </Badge>
            <h1 className="max-w-4xl text-[clamp(2rem,9vw,3.75rem)] font-semibold leading-[1.04] tracking-normal text-zinc-950">
              Ship an operations control plane that proves the backend, not just the UI.
            </h1>
            <p className="mt-6 max-w-3xl text-base leading-7 text-zinc-700 sm:text-xl sm:leading-8">
              PulseOps is built for backend developers and SRE learners who want to prove a real
              end-to-end system: API-key ingestion, Redis hot state, RabbitMQ workers, automatic
              incidents, realtime dashboards, and Vault-style secret access.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Button asChild className="w-full sm:w-auto">
                <Link to="/register">
                  Create project
                  <ArrowRight aria-hidden="true" className="h-4 w-4" />
                </Link>
              </Button>
              <Button asChild className="w-full sm:w-auto" variant="outline">
                <Link to="/login">Open dashboard</Link>
              </Button>
            </div>
          </div>

          <Card className="mt-9 max-w-6xl bg-background/82 backdrop-blur-md" data-reveal>
            <CardContent className="grid gap-0 p-0 md:grid-cols-5">
              {heroFlow.map(([label, text, Icon], index) => (
                <div
                  key={label}
                  className="relative border-b p-4 last:border-b-0 md:border-b-0 md:border-r md:last:border-r-0"
                >
                  <div className="mb-4 flex items-center justify-between gap-3">
                    <span className="text-xs font-semibold uppercase text-muted-foreground">
                      {label}
                    </span>
                    <Icon aria-hidden="true" className="h-4 w-4 text-cyan-700" />
                  </div>
                  <p className="min-h-12 text-sm font-medium leading-5 text-zinc-900">{text}</p>
                  {index < heroFlow.length - 1 ? (
                    <ArrowRight
                      aria-hidden="true"
                      className="absolute -right-3 top-1/2 z-10 hidden h-5 w-5 -translate-y-1/2 rounded-full border bg-background p-0.5 text-muted-foreground md:block"
                    />
                  ) : null}
                </div>
              ))}
            </CardContent>
          </Card>

          <div className="mt-10 grid gap-2 sm:grid-cols-3 md:gap-3" data-reveal>
            {mvpSignals.map((signal) => (
              <Card key={signal.label} className="bg-background/78 backdrop-blur-md">
                <CardContent className="flex min-h-28 flex-col justify-between p-3 md:min-h-0 md:flex-row md:items-end md:p-5">
                  <p className="text-xs leading-4 text-muted-foreground md:text-sm">
                    {signal.label}
                  </p>
                  <p className={`text-3xl font-semibold md:text-5xl ${signal.tone}`}>
                    {signal.value}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <section id="mvp" className="px-5 pb-20 pt-10 sm:px-8 sm:pt-16">
        <div className="mx-auto max-w-7xl">
          <div
            className="mb-10 flex flex-col gap-4 md:flex-row md:items-end md:justify-between"
            data-reveal
          >
            <div>
              <Badge variant="secondary">MVP purpose</Badge>
              <h2 className="mt-4 max-w-3xl text-[clamp(1.75rem,6vw,3rem)] font-semibold leading-tight">
                Prove the full architecture works, not just that screens exist.
              </h2>
            </div>
            <p className="max-w-md text-sm leading-6 text-muted-foreground">
              The demo is complete when telemetry travels from HTTP ingestion through queues,
              workers, storage, Redis counters, incident rules, live dashboard updates, and vault
              audit logs.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {productPillars.map((item, index) => {
              const Icon = item.icon;
              return (
                <Card
                  key={item.label}
                  className="professional-card"
                  data-reveal
                  style={{ "--reveal-delay": `${index * 90}ms` } as CSSProperties}
                >
                  <CardHeader>
                    <div className="mb-4 grid h-10 w-10 place-items-center rounded-md border bg-background">
                      <Icon aria-hidden="true" className="h-5 w-5 text-zinc-800" />
                    </div>
                    <Badge className="w-fit" variant="outline">
                      {item.label}
                    </Badge>
                    <CardTitle className="pt-3 text-xl leading-6">{item.title}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <CardDescription className="leading-6">{item.text}</CardDescription>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </section>

      <section id="pipeline" className="border-y bg-zinc-50 px-5 py-20 sm:px-8">
        <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[0.75fr_1.25fr]">
          <div data-reveal>
            <Badge variant="outline">
              <Workflow aria-hidden="true" className="mr-2 h-3.5 w-3.5" />
              Recruiter demo path
            </Badge>
            <h2 className="mt-4 text-[clamp(1.75rem,6vw,3rem)] font-semibold leading-tight">
              One traceable flow from app event to live incident.
            </h2>
            <p className="mt-5 text-base leading-7 text-muted-foreground">
              A reviewer should be able to follow one telemetry event through validation, Redis rate
              limiting, RabbitMQ publish, worker consumption, MongoDB persistence, Redis counters,
              incident evaluation, and a WebSocket update.
            </p>
          </div>

          <Card className="bg-background" data-reveal>
            <CardContent className="p-0">
              {demoPath.map(([step, title, text], index) => (
                <div key={step}>
                  <div className="grid gap-4 p-5 sm:grid-cols-[3rem_1fr]">
                    <div className="grid h-10 w-10 place-items-center rounded-md bg-zinc-950 font-mono text-sm text-white">
                      {step}
                    </div>
                    <div>
                      <h3 className="font-semibold">{title}</h3>
                      <p className="mt-1 text-sm leading-6 text-muted-foreground">{text}</p>
                    </div>
                  </div>
                  {index < demoPath.length - 1 ? <Separator /> : null}
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </section>

      <section id="security" className="px-5 py-20 sm:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="mb-10 max-w-3xl" data-reveal>
            <Badge variant="success">
              <CheckCircle2 aria-hidden="true" className="mr-2 h-3.5 w-3.5" />
              Security and resilience
            </Badge>
            <h2 className="mt-4 text-[clamp(1.75rem,6vw,3rem)] font-semibold leading-tight">
              The project exists to show backend discipline under pressure.
            </h2>
          </div>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {securityControls.map((item, index) => {
              const Icon = item.icon;
              return (
                <Card
                  key={item.title}
                  className="professional-card"
                  data-reveal
                  style={{ "--reveal-delay": `${index * 80}ms` } as CSSProperties}
                >
                  <CardHeader>
                    <Icon aria-hidden="true" className="h-6 w-6 text-cyan-700" />
                    <CardTitle className="text-xl leading-6">{item.title}</CardTitle>
                    <CardDescription className="leading-6">{item.text}</CardDescription>
                  </CardHeader>
                </Card>
              );
            })}
          </div>
        </div>
      </section>

      <section id="dashboard" className="border-t bg-slate-50 px-5 py-20 sm:px-8">
        <div className="mx-auto max-w-7xl">
          <div
            className="mb-10 flex flex-col gap-4 md:flex-row md:items-end md:justify-between"
            data-reveal
          >
            <div>
              <Badge variant="outline">Operational dashboard</Badge>
              <h2 className="mt-4 max-w-3xl text-[clamp(1.75rem,6vw,3rem)] font-semibold leading-tight">
                The first real screen after login is a live command center.
              </h2>
            </div>
            <p className="max-w-sm text-sm leading-6 text-muted-foreground">
              The frontend plan calls for dense, scan-friendly views: project selector, environment
              selector, live connection state, charts, tables, incidents, queues, and vault audit
              activity.
            </p>
          </div>

          <div className="stack-grid">
            {dashboardSurfaces.map((surface, index) => (
              <Card
                key={surface}
                className="professional-card bg-background"
                data-reveal
                style={{ "--reveal-delay": `${index * 55}ms` } as CSSProperties}
              >
                <CardContent className="flex items-center gap-3 p-4">
                  <Zap aria-hidden="true" className="h-5 w-5 text-amber-600" />
                  <span className="text-sm font-medium">{surface}</span>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
