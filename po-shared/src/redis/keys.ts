export function toApiKeyCacheKey(keyHash: string): string {
  return `apiKey:${keyHash}`;
}

export const WORKER_HEARTBEAT_KEY_PREFIX = "workerHeartbeat";

export function toWorkerHeartbeatKey(workerId: string): string {
  return `${WORKER_HEARTBEAT_KEY_PREFIX}:${workerId}`;
}

export function toWorkerHeartbeatPattern(): string {
  return `${WORKER_HEARTBEAT_KEY_PREFIX}:*`;
}
