import { randomUUID } from "node:crypto";
import type { PulseOpsClient } from "../client.js";

export type JobInstrumentationOptions = {
  readonly queueName?: string;
  readonly jobId?: string;
  readonly correlationId?: string;
  readonly attributes?: Record<string, unknown>;
};

/**
 * Wrap and instrument an asynchronous background task or queue job.
 * Automatically measures duration, logs execution status, records success/error metrics,
 * and reports unhandled exceptions to PulseOps.
 */
export async function instrumentJob<T>(
  client: PulseOpsClient,
  jobName: string,
  jobFn: () => Promise<T>,
  options?: JobInstrumentationOptions,
): Promise<T> {
  const jobId = options?.jobId ?? randomUUID();
  const correlationId = options?.correlationId ?? jobId;
  const queueName = options?.queueName ?? "default";

  const startTime = process.hrtime.bigint();

  client.log("info", `Job ${jobName} started [id: ${jobId}]`, {
    jobName,
    jobId,
    queueName,
    correlationId,
    ...(options?.attributes ?? {}),
  });

  try {
    const result = await jobFn();

    const endTime = process.hrtime.bigint();
    const durationMs = Number(endTime - startTime) / 1_000_000;

    client.log(
      "info",
      `Job ${jobName} completed successfully [id: ${jobId}] in ${Math.round(durationMs)}ms`,
      {
        jobName,
        jobId,
        queueName,
        correlationId,
        durationMs: Math.round(durationMs * 100) / 100,
        status: "success",
        ...(options?.attributes ?? {}),
      },
    );

    client.timing("job_duration_ms", durationMs, {
      jobName,
      queueName,
      status: "success",
    });

    client.increment("job_executions_total", 1, {
      jobName,
      queueName,
      status: "success",
    });

    return result;
  } catch (err) {
    const endTime = process.hrtime.bigint();
    const durationMs = Number(endTime - startTime) / 1_000_000;

    client.error(err, {
      jobName,
      jobId,
      queueName,
      correlationId,
      durationMs: Math.round(durationMs * 100) / 100,
      status: "failed",
      ...(options?.attributes ?? {}),
    });

    client.timing("job_duration_ms", durationMs, {
      jobName,
      queueName,
      status: "failed",
    });

    client.increment("job_executions_total", 1, {
      jobName,
      queueName,
      status: "failed",
    });

    client.increment("job_errors_total", 1, {
      jobName,
      queueName,
    });

    throw err;
  }
}
