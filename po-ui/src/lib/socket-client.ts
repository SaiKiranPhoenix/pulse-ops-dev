import { io, type Socket } from "socket.io-client";
import { getAccessToken } from "@/lib/api-client";
import type { RealtimeEventCreated, RealtimeIncidentUpdate } from "@/features/dashboards/api";
import type { VaultAuditEvent } from "@/features/vault/api";

export const realtimeUrl = import.meta.env.VITE_REALTIME_URL ?? "http://localhost:4130";

type ServerToClientEvents = {
  "event.created": (message: RealtimeEventCreated) => void;
  "incident.updated": (message: RealtimeIncidentUpdate) => void;
  "vault.audit.created": (message: RealtimeVaultAuditCreated) => void;
  "project:joined": (message: { readonly projectId: string }) => void;
  "project:left": (message: { readonly projectId: string }) => void;
};

export type RealtimeVaultAuditCreated = {
  readonly messageId: string;
  readonly schemaVersion: 1;
  readonly projectId: string;
  readonly auditEvent: VaultAuditEvent;
  readonly occurredAt: string;
};

type ClientToServerEvents = {
  "project:join": (
    payload: { readonly projectId: string },
    acknowledge: (response: { readonly ok: boolean; readonly error?: string }) => void,
  ) => void;
  "project:leave": (payload: { readonly projectId: string }) => void;
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
): Promise<{ readonly ok: boolean; readonly error?: string }> {
  return new Promise((resolve) => {
    socket.emit(
      "project:join",
      { projectId },
      (response: { readonly ok: boolean; readonly error?: string }) => {
        resolve(response);
      },
    );
  });
}

export function leaveProjectRoom(socket: PulseOpsSocket, projectId: string): void {
  socket.emit("project:leave", { projectId });
}
