import { io, type Socket } from "socket.io-client";
import { getAccessToken } from "@/lib/api-client";
import type {
  QueueStatus,
  RealtimeEventCreated,
  RealtimeIncidentUpdate,
  WorkerHealth,
} from "@/features/dashboards/api";
import type { VaultAuditEvent } from "@/features/vault/api";

export const realtimeUrl = import.meta.env.VITE_REALTIME_URL ?? "http://localhost:4130";

type ServerToClientEvents = {
  "event.created": (message: RealtimeEventCreated) => void;
  "incident.updated": (message: RealtimeIncidentUpdate) => void;
  "queue.status": (message: RealtimeQueueStatus) => void;
  "vault.audit.created": (message: RealtimeVaultAuditCreated) => void;
  "worker.heartbeat": (message: RealtimeWorkerHeartbeat) => void;
  "project:joined": (message: {
    readonly projectId: string;
    readonly environment?: string | null;
  }) => void;
  "project:left": (message: {
    readonly projectId: string;
    readonly environment?: string | null;
  }) => void;
};

export type RealtimeVaultAuditCreated = {
  readonly messageId: string;
  readonly schemaVersion: 1;
  readonly projectId: string;
  readonly auditEvent: VaultAuditEvent;
  readonly occurredAt: string;
};

export type RealtimeWorkerHeartbeat = {
  readonly messageId: string;
  readonly schemaVersion: 1;
  readonly worker: Omit<WorkerHealth, "ageSeconds">;
  readonly occurredAt: string;
};

export type RealtimeQueueStatus = {
  readonly messageId: string;
  readonly schemaVersion: 1;
  readonly queues: Array<Omit<QueueStatus, "health" | "backlogWarning">>;
  readonly occurredAt: string;
};

type ClientToServerEvents = {
  "project:join": (
    payload: { readonly projectId: string; readonly environment?: string },
    acknowledge: (response: { readonly ok: boolean; readonly error?: string }) => void,
  ) => void;
  "project:leave": (payload: { readonly projectId: string; readonly environment?: string }) => void;
};

export type PulseOpsSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

export function createPulseOpsSocket(): PulseOpsSocket | null {
  const token = getAccessToken();

  if (token === null) {
    return null;
  }

  return io(realtimeUrl, {
    autoConnect: false,
    auth: { token },
    transports: ["websocket"],
  });
}

export function joinProjectRoom(
  socket: PulseOpsSocket,
  projectId: string,
  environment?: string,
): Promise<{ readonly ok: boolean; readonly error?: string }> {
  return new Promise((resolve) => {
    socket.emit(
      "project:join",
      environment === undefined ? { projectId } : { projectId, environment },
      (response: { readonly ok: boolean; readonly error?: string }) => {
        resolve(response);
      },
    );
  });
}

export function leaveProjectRoom(
  socket: PulseOpsSocket,
  projectId: string,
  environment?: string,
): void {
  socket.emit(
    "project:leave",
    environment === undefined ? { projectId } : { projectId, environment },
  );
}
