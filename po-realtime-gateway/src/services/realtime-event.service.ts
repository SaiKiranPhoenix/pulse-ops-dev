import {
  REALTIME_SOCKET_EVENTS,
  realtimeIncidentUpdateMessageSchema,
  toProjectRoom,
  type RealtimeIncidentUpdateMessage,
} from "@pulseops/shared";

export type SocketRoomEmitter = {
  to(room: string): {
    emit(event: string, payload: RealtimeIncidentUpdateMessage): void;
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
}
