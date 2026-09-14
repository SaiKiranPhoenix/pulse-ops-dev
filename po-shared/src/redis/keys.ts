export function toApiKeyCacheKey(keyHash: string): string {
  return `apiKey:${keyHash}`;
}

export const INGESTION_RATE_LIMIT_KEY_PREFIX = "rate";

export function toIngestionRateLimitKey(projectId: string, epochMinute: number): string {
  return `${INGESTION_RATE_LIMIT_KEY_PREFIX}:${projectId}:${epochMinute}`;
}

export const WORKER_HEARTBEAT_KEY_PREFIX = "workerHeartbeat";

export function toWorkerHeartbeatKey(workerId: string): string {
  return `${WORKER_HEARTBEAT_KEY_PREFIX}:${workerId}`;
}

export function toWorkerHeartbeatPattern(): string {
  return `${WORKER_HEARTBEAT_KEY_PREFIX}:*`;
}
