import { Activity, Boxes, LockKeyhole, RadioTower } from "lucide-react";
import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

type AuthSplitLayoutProps = {
  readonly eyebrow: string;
  readonly title: string;
  readonly description: string;
  readonly children: ReactNode;
};

const authSignals = [
  { label: "Ingest", icon: RadioTower },
  { label: "Queue", icon: Boxes },
  { label: "Detect", icon: Activity },
  { label: "Vault", icon: LockKeyhole },
] as const;

export function AuthSplitLayout({ eyebrow, title, description, children }: AuthSplitLayoutProps) {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <section className="grid min-h-screen lg:grid-cols-2">
        <div className="relative hidden min-h-screen overflow-hidden bg-slate-50 lg:block">
          <img
            alt="PulseOps operational telemetry, queues, incidents, and vault security visual"
            className="absolute inset-0 h-full w-full object-cover"
            decoding="async"
            fetchPriority="high"
            src="/images/auth-operations-visual.png"
          />
          <div className="absolute inset-0 bg-gradient-to-br from-white/26 via-white/8 to-cyan-50/28" />
          <Link
            className="absolute left-8 top-8 flex items-center gap-3 rounded-full bg-white/76 py-2 pl-2 pr-4 text-sm font-semibold text-zinc-950 shadow-sm backdrop-blur-xl"
            to="/"
          >
            <span className="grid h-10 w-10 place-items-center rounded-lg bg-zinc-950 text-sm font-black text-white">
              PO
            </span>
            PulseOps
          </Link>

          <Card className="absolute bottom-8 left-8 right-8 border-white/70 bg-white/72 shadow-xl shadow-slate-300/30 backdrop-blur-xl">
            <CardContent className="p-5">
              <Badge className="mb-4 bg-white/80" variant="outline">
                Local-first architecture
              </Badge>
              <p className="max-w-xl text-2xl font-semibold leading-tight text-zinc-950">
                Sign in to operate the telemetry pipeline from ingestion to incidents.
              </p>
              <div className="mt-5 grid grid-cols-4 gap-2">
                {authSignals.map((signal) => {
                  const Icon = signal.icon;
                  return (
                    <div
                      key={signal.label}
                      className="rounded-md border border-white/72 bg-white/62 p-3 text-zinc-800"
                    >
                      <Icon aria-hidden="true" className="h-4 w-4 text-cyan-700" />
                      <p className="mt-2 text-xs font-semibold">{signal.label}</p>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="flex min-h-screen items-center justify-center px-5 py-8 sm:px-8">
          <div className="w-full max-w-md">
            <Link className="mb-8 flex items-center gap-3 lg:hidden" to="/">
              <span className="grid h-10 w-10 place-items-center rounded-lg bg-zinc-950 text-sm font-black text-white">
                PO
              </span>
              <span className="text-sm font-semibold text-zinc-950">PulseOps</span>
            </Link>

            <Card className="border-border/80 shadow-sm">
              <CardContent className="p-6 sm:p-8">
                <div className="mb-7">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {eyebrow}
                  </p>
                  <h1 className="mt-2 text-3xl font-semibold tracking-normal text-zinc-950">
                    {title}
                  </h1>
                  <p className="mt-3 text-sm leading-6 text-muted-foreground">{description}</p>
                </div>

                {children}
              </CardContent>
            </Card>
          </div>
        </div>
      </section>
    </main>
  );
}
