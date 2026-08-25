import { AlertTriangle, Clipboard, RefreshCw, Search, Send } from "lucide-react";
import { type FormEvent, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { listErrorGroups, type ErrorGroup } from "@/features/dashboards/api";
import { ingestError } from "@/features/ingestion/api";
import { getApiErrorMessage } from "@/lib/api-client";
import { formatRelativeTime, severityClass } from "./dashboard-utils";
import { useDashboardContext } from "./DashboardLayout";

const statuses = ["all", "open", "resolved", "no_incident"] as const;

type StatusFilter = (typeof statuses)[number];

export function ErrorsPage() {
  const { selectedEnvironment, selectedProject, selectedTimeRange } = useDashboardContext();
  const [groups, setGroups] = useState<ErrorGroup[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<ErrorGroup | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [serviceFilter, setServiceFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [testApiKey, setTestApiKey] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSendingTest, setIsSendingTest] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function loadErrors(): Promise<void> {
    if (selectedProject === null) {
      setGroups([]);
      setSelectedGroup(null);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      setGroups(
        await listErrorGroups(selectedProject.id, {
          environment: selectedEnvironment,
          timeRange: selectedTimeRange,
        }),
      );
    } catch (requestError) {
      setError(getApiErrorMessage(requestError));
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadErrors();
  }, [selectedEnvironment, selectedProject?.id, selectedTimeRange]);

  const services = useMemo(
    () => ["all", ...Array.from(new Set(groups.map((group) => group.source))).sort()],
    [groups],
  );
  const filteredGroups = useMemo(
    () =>
      groups.filter((group) => {
        const groupStatus = group.incident?.status ?? "no_incident";
        const searchable = [group.fingerprint, group.source, group.message, group.incident?.title]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

        return (
          (statusFilter === "all" || groupStatus === statusFilter) &&
          (serviceFilter === "all" || group.source === serviceFilter) &&
          (search.trim().length === 0 || searchable.includes(search.trim().toLowerCase()))
        );
      }),
    [groups, search, serviceFilter, statusFilter],
  );

  useEffect(() => {
    setSelectedGroup((current) =>
      current === null
        ? (filteredGroups[0] ?? null)
        : (filteredGroups.find((group) => group.fingerprint === current.fingerprint) ??
          filteredGroups[0] ??
          null),
    );
  }, [filteredGroups]);

  const summary = useMemo(
    () => ({
      groups: groups.length,
      open: groups.filter((group) => group.incident?.status === "open").length,
      samples: groups.reduce((total, group) => total + group.count, 0),
      services: new Set(groups.map((group) => group.source)).size,
    }),
    [groups],
  );

  async function sendRepeatedErrors(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();

    if (testApiKey.trim().length === 0) {
      setError("Paste an ingestion API key before sending repeated errors.");
      return;
    }

    setIsSendingTest(true);
    setError(null);
    setMessage(null);

    try {
      const fingerprint = `demo-checkout-timeout-${Date.now()}`;

      await Promise.all(
        Array.from({ length: 3 }, (_, index) =>
          ingestError(
            {
              apiKey: testApiKey.trim(),
              idempotencyKey: `errors-demo-${fingerprint}-${index}`,
            },
            {
              source: "checkout-api",
              name: "CheckoutTimeout",
              message: "Payment provider timeout",
              fingerprint,
              attributes: {
                environment: selectedEnvironment,
                attempt: index + 1,
                redaction: "authorization headers and secret-like fields are filtered upstream",
              },
            },
          ),
        ),
      );

      setMessage("Repeated errors accepted. Refresh after the worker processes them.");
      await loadErrors();
    } catch (requestError) {
      setError(getApiErrorMessage(requestError));
    } finally {
      setIsSendingTest(false);
    }
  }

  async function copyGroup(group: ErrorGroup): Promise<void> {
    await navigator.clipboard.writeText(toGroupSummary(group));
    setMessage("Error group summary copied.");
  }

  return (
    <main className="mx-auto flex max-w-7xl flex-col gap-5">
      <header className="flex flex-col gap-3 border-b border-slate-200 pb-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-sm font-medium text-cyan-700">
            {selectedProject?.name ?? "No project selected"} / {selectedEnvironment}
            {" / "}
            {selectedTimeRange}
          </p>
          <h1 className="text-2xl font-semibold tracking-normal">Error groups</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
            Group error telemetry by fingerprint, inspect recent samples, and correlate repeated
            failures with incidents.
          </p>
        </div>
        <Button
          className="w-auto"
          onClick={() => void loadErrors()}
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

      <section className="grid gap-3 md:grid-cols-4">
        <Summary label="Error groups" value={summary.groups} />
        <Summary label="Open incidents" value={summary.open} />
        <Summary label="Error samples" value={summary.samples} />
        <Summary label="Services" value={summary.services} />
      </section>

      <section className="grid gap-3 rounded-md border border-slate-200 bg-white p-4 xl:grid-cols-[1fr_10rem_10rem_18rem]">
        <label className="relative block">
          <span className="sr-only">Search error groups</span>
          <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-slate-400" />
          <Input
            className="pl-9"
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search fingerprint, service, message"
            value={search}
          />
        </label>

        <select
          className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm capitalize shadow-sm outline-none focus:ring-2 focus:ring-cyan-700"
          onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}
          value={statusFilter}
        >
          {statuses.map((status) => (
            <option key={status} value={status}>
              {status.replace("_", " ")}
            </option>
          ))}
        </select>

        <select
          className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm shadow-sm outline-none focus:ring-2 focus:ring-cyan-700"
          onChange={(event) => setServiceFilter(event.target.value)}
          value={serviceFilter}
        >
          {services.map((service) => (
            <option key={service} value={service}>
              {service}
            </option>
          ))}
        </select>

        <form className="flex gap-2" onSubmit={sendRepeatedErrors}>
          <Input
            onChange={(event) => setTestApiKey(event.target.value)}
            placeholder="API key for test"
            type="password"
            value={testApiKey}
          />
          <Button className="w-auto" disabled={isSendingTest} type="submit">
            <Send className="h-4 w-4" />
          </Button>
        </form>
      </section>

      <section className="grid gap-4 xl:grid-cols-[1fr_28rem]">
        <div className="rounded-md border border-slate-200 bg-white">
          <div className="grid grid-cols-[1fr_8rem_8rem_8rem_7rem] gap-3 border-b border-slate-100 px-4 py-3 text-xs font-semibold uppercase tracking-normal text-slate-500">
            <span>Error group</span>
            <span>Service</span>
            <span>Incident</span>
            <span>Last seen</span>
            <span className="text-right">Count</span>
          </div>
          {filteredGroups.length === 0 ? (
            <p className="px-4 py-6 text-sm text-slate-500">
              {isLoading ? "Loading error groups" : "No error groups match the current filters"}
            </p>
          ) : (
            <div className="divide-y divide-slate-100">
              {filteredGroups.map((group) => (
                <button
                  className="grid w-full grid-cols-[1fr_8rem_8rem_8rem_7rem] items-center gap-3 px-4 py-3 text-left transition hover:bg-slate-50"
                  key={group.fingerprint}
                  onClick={() => setSelectedGroup(group)}
                  type="button"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 shrink-0 text-red-600" />
                      <p className="truncate text-sm font-semibold text-slate-900">
                        {group.message}
                      </p>
                    </div>
                    <p className="mt-1 truncate font-mono text-xs text-slate-500">
                      {group.fingerprint}
                    </p>
                  </div>
                  <span className="truncate text-sm text-slate-600">{group.source}</span>
                  <IncidentBadge incident={group.incident} />
                  <span className="text-xs text-slate-500">
                    {formatRelativeTime(group.lastSeenAt)}
                  </span>
                  <span className="text-right font-mono text-sm text-slate-700">{group.count}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        <aside className="rounded-md border border-slate-200 bg-white p-4">
          {selectedGroup === null ? (
            <p className="text-sm text-slate-500">Select an error group to inspect samples.</p>
          ) : (
            <ErrorGroupDetail group={selectedGroup} onCopy={() => void copyGroup(selectedGroup)} />
          )}
        </aside>
      </section>
    </main>
  );
}

function ErrorGroupDetail({
  group,
  onCopy,
}: {
  readonly group: ErrorGroup;
  readonly onCopy: () => void;
}) {
  return (
    <div className="grid gap-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-normal text-slate-500">
            Error detail
          </p>
          <h2 className="mt-2 text-lg font-semibold leading-6 text-slate-950">{group.message}</h2>
        </div>
        <Button className="h-9 w-9 px-0" onClick={onCopy} type="button" variant="outline">
          <Clipboard className="h-4 w-4" />
        </Button>
      </div>

      <dl className="grid gap-3 rounded-md border border-slate-200 bg-slate-50 p-3 text-sm">
        <Detail label="Fingerprint" value={group.fingerprint} mono />
        <Detail label="Service" value={group.source} />
        <Detail label="Samples" value={String(group.count)} />
        <Detail label="First seen" value={new Date(group.firstSeenAt).toLocaleString()} />
        <Detail label="Last seen" value={new Date(group.lastSeenAt).toLocaleString()} />
      </dl>

      {group.incident !== null ? (
        <section className="rounded-md border border-slate-200 bg-white p-3">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-sm font-semibold uppercase tracking-normal text-slate-500">
              Related incident
            </h3>
            <span
              className={`rounded-md border px-2 py-1 text-xs font-medium ${severityClass(
                group.incident.severity,
              )}`}
            >
              {group.incident.severity}
            </span>
          </div>
          <p className="mt-2 text-sm font-semibold text-slate-900">{group.incident.title}</p>
          <p className="mt-1 text-xs text-slate-500">
            {group.incident.status} - {group.incident.eventCount} linked events
          </p>
        </section>
      ) : null}

      <section>
        <h3 className="text-sm font-semibold uppercase tracking-normal text-slate-500">
          Stack trace
        </h3>
        {group.stack === null ? (
          <p className="mt-2 rounded-md border border-slate-200 bg-slate-50 p-3 text-sm text-slate-500">
            No stack trace was attached to the latest sample.
          </p>
        ) : (
          <pre className="mt-2 max-h-72 overflow-auto whitespace-pre-wrap rounded-md border border-slate-200 bg-slate-950 p-3 text-xs leading-5 text-slate-100">
            {formatStack(group.stack)}
          </pre>
        )}
      </section>

      <section>
        <h3 className="text-sm font-semibold uppercase tracking-normal text-slate-500">
          Recent samples
        </h3>
        <div className="mt-3 divide-y divide-slate-100 rounded-md border border-slate-200">
          {group.samples.slice(0, 8).map((sample) => (
            <article className="p-3" key={sample.id}>
              <div className="flex items-center justify-between gap-3">
                <p className="truncate text-sm font-semibold text-slate-900">
                  {sample.message ?? sample.name ?? sample.fingerprint}
                </p>
                <span className="shrink-0 text-xs text-slate-500">
                  {formatRelativeTime(sample.receivedAt)}
                </span>
              </div>
              <p className="mt-1 font-mono text-xs text-slate-500">{sample.id}</p>
              <pre className="mt-2 max-h-36 overflow-auto whitespace-pre-wrap rounded-md bg-slate-50 p-2 text-xs leading-5 text-slate-600">
                {JSON.stringify(redactMetadata(sample.attributes), null, 2)}
              </pre>
            </article>
          ))}
        </div>
      </section>

      <section>
        <h3 className="text-sm font-semibold uppercase tracking-normal text-slate-500">
          Fingerprint inputs
        </h3>
        <div className="mt-2 rounded-md border border-slate-200 bg-slate-50 p-3 font-mono text-xs leading-5 text-slate-700">
          source={group.source}
          <br />
          message={group.message}
          <br />
          fingerprint={group.fingerprint}
        </div>
      </section>
    </div>
  );
}

function IncidentBadge({ incident }: { readonly incident: ErrorGroup["incident"] }) {
  if (incident === null) {
    return <span className={neutralClass}>none</span>;
  }

  return (
    <span className={incident.status === "open" ? openClass : resolvedClass}>
      {incident.status}
    </span>
  );
}

function Summary({ label, value }: { readonly label: string; readonly value: number }) {
  return (
    <div className="rounded-md border border-slate-200 bg-white p-4">
      <p className="text-sm font-medium text-slate-500">{label}</p>
      <p className="mt-3 text-2xl font-semibold tabular-nums">{value}</p>
    </div>
  );
}

function Detail({
  label,
  mono = false,
  value,
}: {
  readonly label: string;
  readonly mono?: boolean;
  readonly value: string;
}) {
  return (
    <div>
      <dt className="text-xs font-semibold uppercase tracking-normal text-slate-500">{label}</dt>
      <dd className={`mt-1 break-words text-slate-900 ${mono ? "font-mono text-xs" : ""}`}>
        {value}
      </dd>
    </div>
  );
}

function toGroupSummary(group: ErrorGroup): string {
  return [
    `Error group: ${group.message}`,
    `Fingerprint: ${group.fingerprint}`,
    `Service: ${group.source}`,
    `Samples: ${group.count}`,
    `First seen: ${group.firstSeenAt}`,
    `Last seen: ${group.lastSeenAt}`,
    group.incident === null
      ? "Incident: none"
      : `Incident: ${group.incident.status} ${group.incident.severity} ${group.incident.title}`,
  ].join("\n");
}

function formatStack(stack: string): string {
  return stack
    .split("\n")
    .map((line) => line.trimEnd())
    .filter((line) => line.length > 0)
    .join("\n");
}

function redactMetadata(value: unknown): unknown {
  if (typeof value === "string") {
    return redactString(value);
  }

  if (value === null || typeof value !== "object") {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map(redactMetadata);
  }

  return Object.fromEntries(
    Object.entries(value).map(([key, nestedValue]) => [
      key,
      isSensitiveKey(key) ? "[REDACTED]" : redactMetadata(nestedValue),
    ]),
  );
}

function isSensitiveKey(key: string): boolean {
  return /authorization|cookie|password|passwd|\bpwd\b|secret|token|api[-_]?key|private[-_]?key|jwt|database[-_]?url|mongodb[-_]?uri|redis[-_]?url|rabbitmq[-_]?url/i.test(
    key,
  );
}

function redactString(value: string): string {
  return value
    .replace(/AKIA[0-9A-Z]{16}/g, "[REDACTED]")
    .replace(/gh[pousr]_[A-Za-z0-9_]{36,}/g, "[REDACTED]")
    .replace(/sk_live_[A-Za-z0-9]{24,}/g, "[REDACTED]")
    .replace(/eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g, "[REDACTED]")
    .replace(/\b(?:mongodb|postgres|mysql|redis|amqp):\/\/[^/\s:@]+:[^@\s]+@/gi, "[REDACTED]");
}

const openClass =
  "w-fit rounded-md border border-red-200 bg-red-50 px-2 py-1 text-xs font-medium capitalize text-red-700";

const resolvedClass =
  "w-fit rounded-md border border-emerald-200 bg-emerald-50 px-2 py-1 text-xs font-medium capitalize text-emerald-700";

const neutralClass =
  "w-fit rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-medium text-slate-600";
