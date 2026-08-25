import {
  REALTIME_SOCKET_EVENTS,
  realtimeEventCreatedMessageSchema,
  realtimeIncidentUpdateMessageSchema,
  toProjectRoom,
  type RealtimeEventCreatedMessage,
  type RealtimeIncidentUpdateMessage,
} from "@pulseops/shared";

type RealtimeSocketPayload = RealtimeIncidentUpdateMessage | RealtimeEventCreatedMessage;

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
    this.emitter
      .to(toProjectRoom(message.projectId))
      .emit(REALTIME_SOCKET_EVENTS.eventCreated, message);
  }
}
