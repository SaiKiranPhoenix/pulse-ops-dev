import type { RealtimeEventCreatedMessage, RealtimeIncidentUpdateMessage } from "@pulseops/shared";
import { describe, expect, it } from "vitest";
import type { SocketRoomEmitter } from "../../src/services/realtime-event.service.js";
import { RealtimeEventService } from "../../src/services/realtime-event.service.js";

class InMemorySocketRoomEmitter implements SocketRoomEmitter {
  readonly emitted: Array<{
    readonly room: string;
    readonly event: string;
    readonly payload: RealtimeEventCreatedMessage | RealtimeIncidentUpdateMessage;
  }> = [];

  to(room: string): {
    emit: (
      event: string,
      payload: RealtimeEventCreatedMessage | RealtimeIncidentUpdateMessage,
    ) => void;
  } {
    return {
      emit: (event, payload) => {
        this.emitted.push({ room, event, payload });
      },
    };
  }
}

describe("RealtimeEventService", () => {
  it("emits incident updates to the project room", () => {
    const emitter = new InMemorySocketRoomEmitter();
    const service = new RealtimeEventService(emitter);

    service.emitIncidentUpdate(validIncidentUpdate());

    expect(emitter.emitted).toHaveLength(1);
    expect(emitter.emitted[0]).toMatchObject({
      room: "project:project_1",
      event: "incident.updated",
      payload: {
        projectId: "project_1",
        action: "opened",
        incident: {
          id: "incident_1",
          eventCount: 1,
        },
      },
    });
  });

  it("emits created events to the project room", () => {
    const emitter = new InMemorySocketRoomEmitter();
    const service = new RealtimeEventService(emitter);

    service.emitEventCreated(validEventCreated());

    expect(emitter.emitted).toHaveLength(1);
    expect(emitter.emitted[0]).toMatchObject({
      room: "project:project_1",
      event: "event.created",
      payload: {
        projectId: "project_1",
        event: {
          id: "event_1",
          type: "log",
        },
      },
    });
  });
});

function validIncidentUpdate(): RealtimeIncidentUpdateMessage {
  return {
    messageId: "incident_1:opened:1",
    schemaVersion: 1,
    projectId: "project_1",
    action: "opened",
    occurredAt: "2026-08-18T00:00:01.000Z",
    incident: {
      id: "incident_1",
      projectId: "project_1",
      fingerprint: "fingerprint_1",
      title: "Error in checkout-api: Payment provider failed",
      summary: "Error fingerprint fingerprint_1 was observed in checkout-api.",
      severity: "high",
      status: "open",
      eventCount: 1,
      firstSeenAt: "2026-08-18T00:00:00.000Z",
      lastSeenAt: "2026-08-18T00:00:00.000Z",
      resolvedAt: null,
      createdAt: "2026-08-18T00:00:00.000Z",
      updatedAt: "2026-08-18T00:00:00.000Z",
    },
  };
}

function validEventCreated(): RealtimeEventCreatedMessage {
  return {
    messageId: "ing_1:event-created",
    schemaVersion: 1,
    projectId: "project_1",
    occurredAt: "2026-08-18T00:00:01.000Z",
    event: {
      id: "event_1",
      projectId: "project_1",
      type: "log",
      source: "checkout-api",
      level: "info",
      message: "Checkout completed",
      name: null,
      value: null,
      fingerprint: "fingerprint_1",
      attributes: {},
      observedAt: "2026-08-18T00:00:00.000Z",
      receivedAt: "2026-08-18T00:00:00.100Z",
    },
  };
}
