import {
  REALTIME_SOCKET_EVENTS,
  OPS_ROOM,
  realtimeEventCreatedMessageSchema,
  realtimeIncidentUpdateMessageSchema,
  realtimeQueueStatusMessageSchema,
  realtimeVaultAuditCreatedMessageSchema,
  realtimeWorkerHeartbeatMessageSchema,
  toProjectEnvironmentRoom,
  toProjectRoom,
  type RealtimeEventCreatedMessage,
  type RealtimeIncidentUpdateMessage,
  type RealtimeQueueStatusMessage,
  type RealtimeVaultAuditCreatedMessage,
  type RealtimeWorkerHeartbeatMessage,
} from "@pulseops/shared";

type RealtimeSocketPayload =
  | RealtimeIncidentUpdateMessage
  | RealtimeEventCreatedMessage
  | RealtimeVaultAuditCreatedMessage
  | RealtimeWorkerHeartbeatMessage
  | RealtimeQueueStatusMessage;

export type SocketRoomEmitter = {
  to(room: string): {
    emit(event: string, payload: RealtimeSocketPayload): void;
  };
};

export class RealtimeEventService {
  constructor(private readonly emitter: SocketRoomEmitter) {}

  emitIncidentUpdate(content: unknown): void {
    const message = realtimeIncidentUpdateMessageSchema.parse(content);
    this.emitter
      .to(toProjectRoom(message.projectId))
      .emit(REALTIME_SOCKET_EVENTS.incidentUpdated, message);
  }

  emitEventCreated(content: unknown): void {
    const message = realtimeEventCreatedMessageSchema.parse(content);
    this.emitToRooms(
      message.projectId,
      readEnvironment(message.event.attributes),
      REALTIME_SOCKET_EVENTS.eventCreated,
      message,
    );
  }

  emitVaultAuditCreated(content: unknown): void {
    const message = realtimeVaultAuditCreatedMessageSchema.parse(content);
    this.emitToRooms(
      message.projectId,
      message.auditEvent.environment,
      REALTIME_SOCKET_EVENTS.vaultAuditCreated,
      message,
    );
  }

  emitWorkerHeartbeat(content: unknown): void {
    const message = realtimeWorkerHeartbeatMessageSchema.parse(content);
    this.emitter.to(OPS_ROOM).emit(REALTIME_SOCKET_EVENTS.workerHeartbeat, message);
  }

  emitQueueStatus(content: unknown): void {
    const message = realtimeQueueStatusMessageSchema.parse(content);
    this.emitter.to(OPS_ROOM).emit(REALTIME_SOCKET_EVENTS.queueStatus, message);
  }

  private emitToRooms(
    projectId: string,
    environment: string | null,
    event: string,
    payload: RealtimeSocketPayload,
  ): void {
    this.emitter.to(toProjectRoom(projectId)).emit(event, payload);

    if (environment !== null) {
      this.emitter.to(toProjectEnvironmentRoom(projectId, environment)).emit(event, payload);
    }
  }
}

function readEnvironment(attributes: Record<string, unknown>): string | null {
  const environment = attributes.environment;
  return typeof environment === "string" && environment.trim().length > 0 ? environment : null;
}
