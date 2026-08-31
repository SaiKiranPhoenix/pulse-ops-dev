import { PulseOpsClient } from "./client.js";
import type { PulseOpsOptions } from "./types.js";

let defaultClient: PulseOpsClient | null = null;

/**
 * Initialize the global default PulseOps client singleton.
 */
export function initPulseOps(options?: Partial<PulseOpsOptions>): PulseOpsClient {
  const apiKey = options?.apiKey ?? process.env.PULSEOPS_API_KEY ?? "";
  const endpoint = options?.endpoint ?? process.env.PULSEOPS_ENDPOINT ?? "http://localhost:4000";
  const serviceName = options?.serviceName ?? process.env.SERVICE_NAME ?? "unnamed-service";
  const environment = options?.environment ?? process.env.NODE_ENV ?? "development";

  defaultClient = new PulseOpsClient({
    apiKey,
    endpoint,
    serviceName,
    environment,
    ...options,
  });

  return defaultClient;
}

/**
 * Get the currently initialized global PulseOps client singleton.
 */
export function getPulseOpsClient(): PulseOpsClient | null {
  return defaultClient;
}

// Re-export core classes & functions
export { PulseOpsClient } from "./client.js";
export { Redactor } from "./redactor.js";
export { createPulseOpsMiddleware, createPulseOpsErrorHandler } from "./middleware/express.js";
export { instrumentJob } from "./helpers/jobs.js";
export {
  generateTraceId,
  generateSpanId,
  formatW3CTraceParent,
  parseW3CTraceParent,
  ActiveSpan,
  withSpan,
  type SpanOptions,
} from "./tracing.js";

// Re-export types
export type {
  PulseOpsOptions,
  LogLevel,
  LogPayload,
  MetricPayload,
  ErrorPayload,
  QueuedIngestItem,
  ExpressMiddlewareOptions,
} from "./types.js";
export type { JobInstrumentationOptions } from "./helpers/jobs.js";

