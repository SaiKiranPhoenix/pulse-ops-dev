import { Boxes, RadioTower, RefreshCw } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  listDeadLetters,
  getQueueStatus,
  getWorkerStatus,
  replayDeadLetters,
  type DeadLetterMessage,
  type QueueStatus,
  type WorkerHealth,
} from "@/features/dashboards/api";
import { getApiErrorMessage } from "@/lib/api-client";
import {
  createPulseOpsSocket,
  type RealtimeQueueStatus,
  type RealtimeWorkerHeartbeat,
} from "@/lib/socket-client";
import { formatRelativeTime } from "./dashboard-utils";

export function WorkersPage() {
  const [workers, setWorkers] = useState<WorkerHealth[]>([]);
  const [queues, setQueues] = useState<QueueStatus[]>([]);
  const [deadLetters, setDeadLetters] = useState<DeadLetterMessage[]>([]);
  const [selectedWorkerId, setSelectedWorkerId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isReplaying, setIsReplaying] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function loadOps(): Promise<void> {
    setIsLoading(true);
    setError(null);

    try {
      const [workerStatus, queueStatus, deadLetterMessages] = await Promise.all([
        getWorkerStatus(),
        getQueueStatus(),
        listDeadLetters(),
      ]);
      setWorkers(workerStatus.workers);
      setQueues(queueStatus.queues);
      setDeadLetters(deadLetterMessages);
    } catch (requestError) {
      setError(getApiErrorMessage(requestError));
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadOps();

    const refreshInterval = window.setInterval(() => {
      void loadOps();
    }, 15_000);

    return () => window.clearInterval(refreshInterval);
  }, []);

  useEffect(() => {
    const socket = createPulseOpsSocket();

    if (socket === null) {
      return;
    }

    socket.on("connect", () => {
      void loadOps();
    });
    socket.on("worker.heartbeat", (update: RealtimeWorkerHeartbeat) => {
      setWorkers((current) => upsertWorker(current, update));
    });
    socket.on("queue.status", (update: RealtimeQueueStatus) => {
      setQueues(update.queues.map(toQueueHealth));
    });
    socket.connect();

    return () => {
      socket.disconnect();
    };
  }, []);

  const totalMessages = useMemo(
    () => queues.reduce((total, queue) => total + (queue.messageCount ?? 0), 0),
    [queues],
  );
  const totalConsumers = useMemo(
    () => queues.reduce((total, queue) => total + (queue.consumerCount ?? 0), 0),
    [queues],
  );
  const staleWorkers = useMemo(
    () => workers.filter((worker) => worker.ageSeconds > 30).length,
    [workers],
  );
  const processedEvents = useMemo(
    () => workers.reduce((total, worker) => total + worker.metrics.processed, 0),
    [workers],
  );
  const failedEvents = useMemo(
    () => workers.reduce((total, worker) => total + worker.metrics.failed, 0),
    [workers],
  );
  const poisonMessages = useMemo(
    () => workers.reduce((total, worker) => total + worker.metrics.poisonMessages, 0),
    [workers],
  );
  const blockedQueues = useMemo(
    () => queues.filter((queue) => queue.health === "blocked").length,
    [queues],
  );
  const selectedWorker =
    workers.find((worker) => worker.workerId === selectedWorkerId) ?? workers[0] ?? null;

  async function replayDlq(): Promise<void> {
    setIsReplaying(true);
    setError(null);
    setMessage(null);

    try {
      const replayed = await replayDeadLetters(10);
      setMessage(`${replayed} dead-letter message${replayed === 1 ? "" : "s"} replayed.`);
      await loadOps();
    } catch (requestError) {
      setError(getApiErrorMessage(requestError));
    } finally {
      setIsReplaying(false);
    }
  }

  return (
    <main className="mx-auto flex max-w-7xl flex-col gap-5">
      <header className="flex flex-col gap-3 border-b border-slate-200 pb-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-sm font-medium text-cyan-700">Runtime operations</p>
          <h1 className="text-2xl font-semibold tracking-normal">Workers and queues</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
            Inspect event workers, queue depth, and consumer availability across the local stack.
          </p>
        </div>
        <Button className="w-auto" onClick={() => void loadOps()} type="button" variant="outline">
          <RefreshCw className="h-4 w-4" />
          Refresh
        </Button>
      </header>

      {error !== null ? (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      {message !== null ? (
        <div className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {message}
        </div>
      ) : null}

      <section className="grid gap-3 md:grid-cols-4">
        <Summary label="Workers" value={workers.length} />
        <Summary label="Stale workers" value={staleWorkers} />
        <Summary label="Processed" value={processedEvents} />
        <Summary label="Failed" value={failedEvents} />
      </section>

      <section className="grid gap-3 md:grid-cols-4">
        <Summary label="Queued messages" value={totalMessages} />
        <Summary label="Consumers" value={totalConsumers} />
        <Summary label="Blocked queues" value={blockedQueues} />
        <Summary label="Poison messages" value={poisonMessages} />
      </section>

      <section className="grid gap-3 md:grid-cols-4">
        <Summary
          label="Retries"
          value={workers.reduce((total, worker) => total + worker.metrics.retries, 0)}
        />
        <Summary label="Dead letters" value={deadLetters.length} />
      </section>

      <section className="grid gap-4 xl:grid-cols-[1fr_24rem]">
        <div className="rounded-md border border-slate-200 bg-white">
          <div className="flex items-center gap-2 border-b border-slate-100 px-4 py-3">
            <RadioTower className="h-4 w-4 text-cyan-700" />
            <h2 className="text-sm font-semibold uppercase tracking-normal text-slate-500">
              Worker heartbeat
            </h2>
          </div>
          {workers.length === 0 ? (
            <p className="px-4 py-6 text-sm text-slate-500">
              {isLoading ? "Loading workers" : "No worker heartbeats observed"}
            </p>
          ) : (
            <div className="divide-y divide-slate-100">
              {workers.map((worker) => (
                <button
                  className="w-full px-4 py-3 text-left transition hover:bg-slate-50"
                  key={worker.workerId}
                  onClick={() => setSelectedWorkerId(worker.workerId)}
                  type="button"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-slate-900">
                        {worker.workerId}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        {worker.service} - {worker.queues.join(", ") || "no queues"}
                      </p>
                    </div>
                    <span className={worker.ageSeconds > 30 ? staleClass : healthyClass}>
                      {worker.ageSeconds > 30 ? "stale" : worker.status}
                    </span>
                  </div>
                  <p className="mt-2 text-xs text-slate-500">
                    Last seen {formatRelativeTime(worker.lastSeenAt)}; age {worker.ageSeconds}s
                  </p>
                  <div className="mt-3 grid grid-cols-4 gap-2 text-xs">
                    <MiniCounter label="Log" value={worker.metrics.processedByType.log} />
                    <MiniCounter label="Error" value={worker.metrics.processedByType.error} />
                    <MiniCounter label="Metric" value={worker.metrics.processedByType.metric} />
                    <MiniCounter label="Failed" value={worker.metrics.failed} />
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        <aside className="rounded-md border border-slate-200 bg-white p-4">
          {selectedWorker === null ? (
            <p className="text-sm text-slate-500">Select a worker to inspect processing details.</p>
          ) : (
            <WorkerDetail worker={selectedWorker} />
          )}
        </aside>
      </section>

      <section className="rounded-md border border-slate-200 bg-white">
        <div className="flex items-center gap-2 border-b border-slate-100 px-4 py-3">
          <Boxes className="h-4 w-4 text-cyan-700" />
          <h2 className="text-sm font-semibold uppercase tracking-normal text-slate-500">
            Queue depth
          </h2>
        </div>
        {queues.length === 0 ? (
          <p className="px-4 py-6 text-sm text-slate-500">
            {isLoading ? "Loading queues" : "No queues observed"}
          </p>
        ) : (
          <div className="divide-y divide-slate-100">
            {queues.map((queue) => (
              <article
                className="grid grid-cols-[1fr_6rem_6rem_7rem] items-center gap-3 px-4 py-3"
                key={queue.name}
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-slate-900">{queue.name}</p>
                  <p className="mt-1 text-xs text-slate-500">
                    {queue.backlogWarning ?? queue.status}
                  </p>
                </div>
                <span className="text-right font-mono text-sm text-slate-700">
                  {queue.messageCount ?? "-"}
                </span>
                <span className="text-right font-mono text-sm text-slate-700">
                  {queue.consumerCount ?? "-"}
                </span>
                <span className={queue.health === "clear" ? healthyClass : staleClass}>
                  {queue.health}
                </span>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="rounded-md border border-slate-200 bg-white">
        <div className="flex flex-col gap-3 border-b border-slate-100 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <Boxes className="h-4 w-4 text-cyan-700" />
            <h2 className="text-sm font-semibold uppercase tracking-normal text-slate-500">
              Dead-letter queue
            </h2>
          </div>
          <Button
            className="w-auto"
            disabled={deadLetters.length === 0 || isReplaying}
            onClick={() => void replayDlq()}
            type="button"
            variant="outline"
          >
            Replay 10
          </Button>
        </div>
        {deadLetters.length === 0 ? (
          <p className="px-4 py-6 text-sm text-slate-500">
            {isLoading ? "Loading dead letters" : "No dead-letter messages observed"}
          </p>
        ) : (
          <div className="divide-y divide-slate-100">
            {deadLetters.map((deadLetter) => (
              <article className="grid gap-3 px-4 py-3" key={deadLetter.id}>
                <div className="grid gap-3 md:grid-cols-[1fr_10rem_10rem]">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-900">
                      {deadLetter.originalRoutingKey ?? deadLetter.routingKey}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      {deadLetter.deadLetterReason ?? "unknown reason"} /{" "}
                      {deadLetter.originalExchange ?? deadLetter.exchange}
                    </p>
                  </div>
                  <span className="font-mono text-xs text-slate-500">
                    {deadLetter.contentType ?? "-"}
                  </span>
                  <span className={deadLetter.redelivered ? staleClass : healthyClass}>
                    {deadLetter.redelivered ? "redelivered" : "parked"}
                  </span>
                </div>
                <pre className="max-h-48 overflow-auto whitespace-pre-wrap break-words rounded-md bg-slate-950 p-3 text-xs leading-5 text-slate-100">
                  {JSON.stringify(deadLetter.payload, null, 2)}
                </pre>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
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

function MiniCounter({ label, value }: { readonly label: string; readonly value: number }) {
  return (
    <div className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1">
      <p className="text-slate-500">{label}</p>
      <p className="font-mono font-semibold text-slate-900">{value}</p>
    </div>
  );
}

function WorkerDetail({ worker }: { readonly worker: WorkerHealth }) {
  return (
    <div className="grid gap-4">
      <div>
        <p className="text-xs font-semibold uppercase tracking-normal text-slate-500">
          Worker detail
        </p>
        <h2 className="mt-2 break-all text-lg font-semibold text-slate-950">{worker.workerId}</h2>
        <p className="mt-1 text-sm text-slate-500">{worker.service}</p>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Detail label="Processed" value={worker.metrics.processed} />
        <Detail label="Failed" value={worker.metrics.failed} />
        <Detail label="Retries" value={worker.metrics.retries} />
        <Detail label="Poison" value={worker.metrics.poisonMessages} />
      </div>
      <div className="rounded-md border border-slate-200 bg-slate-50 p-3 text-sm">
        <p className="font-semibold text-slate-900">Queues</p>
        <p className="mt-2 break-words text-slate-600">{worker.queues.join(", ")}</p>
      </div>
      <div className="rounded-md border border-slate-200 bg-slate-50 p-3 text-sm">
        <p className="font-semibold text-slate-900">Last processing</p>
        <p className="mt-2 text-slate-600">
          {worker.metrics.lastProcessedAt === null
            ? "No processed events reported"
            : formatRelativeTime(worker.metrics.lastProcessedAt)}
        </p>
      </div>
      {worker.metrics.lastErrorAt !== null ? (
        <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          <p className="font-semibold">Last error</p>
          <p className="mt-2">{formatRelativeTime(worker.metrics.lastErrorAt)}</p>
          <p className="mt-1 break-words font-mono text-xs">
            {worker.metrics.lastErrorMessage ?? "Unknown error"}
          </p>
        </div>
      ) : null}
    </div>
  );
}

function Detail({ label, value }: { readonly label: string; readonly value: number }) {
  return (
    <div className="rounded-md border border-slate-200 bg-white p-3">
      <p className="text-xs font-semibold uppercase tracking-normal text-slate-500">{label}</p>
      <p className="mt-2 font-mono text-lg font-semibold text-slate-950">{value}</p>
    </div>
  );
}

function upsertWorker(workers: WorkerHealth[], update: RealtimeWorkerHeartbeat): WorkerHealth[] {
  const nextWorker: WorkerHealth = {
    ...update.worker,
    ageSeconds: Math.max(
      0,
      Math.floor((Date.now() - Date.parse(update.worker.lastSeenAt)) / 1_000),
    ),
  };
  const workersById = new Map(workers.map((worker) => [worker.workerId, worker]));
  workersById.set(nextWorker.workerId, nextWorker);

  return [...workersById.values()].sort((left, right) =>
    left.workerId.localeCompare(right.workerId),
  );
}

function toQueueHealth(queue: RealtimeQueueStatus["queues"][number]): QueueStatus {
  const messageCount = queue.messageCount ?? 0;
  const consumerCount = queue.consumerCount ?? 0;

  if (queue.status === "missing") {
    return { ...queue, health: "missing", backlogWarning: "Queue is missing in RabbitMQ." };
  }

  if (messageCount > 0 && consumerCount === 0) {
    return {
      ...queue,
      health: "blocked",
      backlogWarning: "Messages are queued but no consumers are attached.",
    };
  }

  if (messageCount >= 100) {
    return {
      ...queue,
      health: "backlog",
      backlogWarning: "Queue backlog is above the local warning threshold.",
    };
  }

  return { ...queue, health: "clear", backlogWarning: null };
}

const healthyClass =
  "shrink-0 rounded-md border border-emerald-200 bg-emerald-50 px-2 py-1 text-xs font-medium capitalize text-emerald-700";

const staleClass =
  "shrink-0 rounded-md border border-amber-200 bg-amber-50 px-2 py-1 text-xs font-medium capitalize text-amber-700";
