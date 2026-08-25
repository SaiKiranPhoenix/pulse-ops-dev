import type {
  RealtimeEventCreatedMessage,
  RealtimeIncidentUpdateMessage,
  RealtimeQueueStatusMessage,
  RealtimeVaultAuditCreatedMessage,
  RealtimeWorkerHeartbeatMessage,
} from "@pulseops/shared";
import { describe, expect, it } from "vitest";
import type { SocketRoomEmitter } from "../../src/services/realtime-event.service.js";
import { RealtimeEventService } from "../../src/services/realtime-event.service.js";

class InMemorySocketRoomEmitter implements SocketRoomEmitter {
  readonly emitted: Array<{
    readonly room: string;
    readonly event: string;
    readonly payload:
      | RealtimeEventCreatedMessage
      | RealtimeIncidentUpdateMessage
      | RealtimeQueueStatusMessage
      | RealtimeWorkerHeartbeatMessage
      | RealtimeVaultAuditCreatedMessage;
  }> = [];

  to(room: string): {
    emit: (
      event: string,
      payload:
        | RealtimeEventCreatedMessage
        | RealtimeIncidentUpdateMessage
        | RealtimeQueueStatusMessage
        | RealtimeWorkerHeartbeatMessage
        | RealtimeVaultAuditCreatedMessage,
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

  it("emits created events to project and environment rooms", () => {
    const emitter = new InMemorySocketRoomEmitter();
    const service = new RealtimeEventService(emitter);

    service.emitEventCreated(validEventCreated());

    expect(emitter.emitted).toHaveLength(2);
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
    expect(emitter.emitted[1]).toMatchObject({
      room: "project:project_1:env:production",
      event: "event.created",
    });
  });

  it("emits vault audit events to project and environment rooms", () => {
    const emitter = new InMemorySocketRoomEmitter();
    const service = new RealtimeEventService(emitter);

    service.emitVaultAuditCreated(validVaultAuditCreated());

    expect(emitter.emitted).toHaveLength(2);
    expect(emitter.emitted[0]).toMatchObject({
      room: "project:project_1",
      event: "vault.audit.created",
      payload: {
        projectId: "project_1",
        auditEvent: {
          id: "audit_1",
          action: "vault.secret.reveal",
        },
      },
    });
    expect(emitter.emitted[1]).toMatchObject({
      room: "project:project_1:env:production",
      event: "vault.audit.created",
    });
  });

  it("emits worker heartbeat and queue status updates to the ops room", () => {
    const emitter = new InMemorySocketRoomEmitter();
    const service = new RealtimeEventService(emitter);

    service.emitWorkerHeartbeat(validWorkerHeartbeat());
    service.emitQueueStatus(validQueueStatus());

    expect(emitter.emitted).toEqual([
      expect.objectContaining({
        room: "ops",
        event: "worker.heartbeat",
        payload: expect.objectContaining({ messageId: "worker_1:1" }),
      }),
      expect.objectContaining({
        room: "ops",
        event: "queue.status",
        payload: expect.objectContaining({ messageId: "queue-status:1" }),
      }),
    ]);
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
      creationReason: "Repeated error telemetry matched by fingerprint",
      acknowledgedAt: null,
      resolutionNote: null,
      samples: [],
      firstSeenAt: "2026-08-18T00:00:00.000Z",
      lastSeenAt: "2026-08-18T00:00:00.000Z",
      resolvedAt: null,
      createdAt: "2026-08-18T00:00:00.000Z",
      updatedAt: "2026-08-18T00:00:00.000Z",
    },
  };
}

function validVaultAuditCreated(): RealtimeVaultAuditCreatedMessage {
  return {
    messageId: "vault-audit:audit_1:1",
    schemaVersion: 1,
    projectId: "project_1",
    occurredAt: "2026-08-18T00:00:01.000Z",
    auditEvent: {
      id: "audit_1",
      messageId: "audit-message-1",
      projectId: "project_1",
      actorType: "user",
      actorId: "user_1",
      action: "vault.secret.reveal",
      result: "success",
      environment: "production",
      secretKey: "DATABASE_URL",
      tokenPrefix: null,
      reason: null,
      correlationId: "req_1",
      occurredAt: "2026-08-18T00:00:00.000Z",
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
      unit: null,
      fingerprint: "fingerprint_1",
      attributes: { environment: "production" },
      observedAt: "2026-08-18T00:00:00.000Z",
      receivedAt: "2026-08-18T00:00:00.100Z",
    },
  };
}

function validWorkerHeartbeat(): RealtimeWorkerHeartbeatMessage {
  return {
    messageId: "worker_1:1",
    schemaVersion: 1,
    worker: {
      workerId: "worker_1",
      service: "po-event-workers",
      status: "running",
      queues: ["pulseops.logs.q"],
      metrics: {
        processed: 1,
        processedByType: { log: 1, error: 0, metric: 0 },
        failed: 0,
        retries: 0,
        poisonMessages: 0,
        lastProcessedAt: "2026-08-18T00:00:01.000Z",
        lastErrorAt: null,
        lastErrorMessage: null,
      },
      startedAt: "2026-08-18T00:00:00.000Z",
      lastSeenAt: "2026-08-18T00:00:01.000Z",
    },
    occurredAt: "2026-08-18T00:00:01.000Z",
  };
}

function validQueueStatus(): RealtimeQueueStatusMessage {
  return {
    messageId: "queue-status:1",
    schemaVersion: 1,
    queues: [
      {
        name: "pulseops.logs.q",
        status: "available",
        messageCount: 1,
        consumerCount: 1,
      },
    ],
    occurredAt: "2026-08-18T00:00:01.000Z",
  };
}
