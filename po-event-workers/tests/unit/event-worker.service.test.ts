import type {
  IncidentEvaluationMessage,
  RealtimeEventCreatedMessage,
  TelemetryEventMessage,
} from "@pulseops/shared";
import { describe, expect, it } from "vitest";
import type { IncidentEvaluationPublisher } from "../../src/events/publishers/incident-evaluation.publisher.js";
import type { EventRepository, SafeEventRecord } from "../../src/repositories/event.repository.js";
import { EventWorkerService } from "../../src/services/event-worker.service.js";

class InMemoryEventRepository implements EventRepository {
  readonly messages: TelemetryEventMessage[] = [];

  async createFromTelemetry(message: TelemetryEventMessage): Promise<SafeEventRecord> {
    this.messages.push(message);

    return {
      id: "event_1",
      messageId: message.messageId,
      projectId: message.projectId,
      type: message.type,
      source: message.source,
      fingerprint: message.fingerprint,
      receivedAt: new Date(message.acceptedAt),
      processedAt: new Date("2026-08-18T00:00:01.000Z"),
      wasCreated: true,
    };
  }

  async findByMessageId(_messageId: string): Promise<SafeEventRecord | null> {
    return null;
  }
}

class InMemoryIncidentEvaluationPublisher implements IncidentEvaluationPublisher {
  readonly messages: IncidentEvaluationMessage[] = [];

  async publish(message: IncidentEvaluationMessage): Promise<void> {
    this.messages.push(message);
  }

  async close(): Promise<void> {}
}

class InMemoryRealtimeEventPublisher {
  readonly messages: RealtimeEventCreatedMessage[] = [];

  async publish(message: RealtimeEventCreatedMessage): Promise<void> {
    this.messages.push(message);
  }

  async close(): Promise<void> {}
}

describe("EventWorkerService", () => {
  it("validates telemetry messages and persists them", async () => {
    const events = new InMemoryEventRepository();
    const incidentEvaluations = new InMemoryIncidentEvaluationPublisher();
    const realtimeEvents = new InMemoryRealtimeEventPublisher();
    const worker = new EventWorkerService(events, incidentEvaluations, realtimeEvents);

    await worker.process(validMessage());

    expect(events.messages).toHaveLength(1);
    expect(events.messages[0]).toMatchObject({
      messageId: "ing_1",
      type: "log",
      projectId: "project_1",
      source: "checkout-api",
    });
    expect(incidentEvaluations.messages).toHaveLength(0);
    expect(realtimeEvents.messages).toHaveLength(1);
    expect(realtimeEvents.messages[0]).toMatchObject({
      messageId: "ing_1:event-created",
      projectId: "project_1",
      event: {
        id: "event_1",
        source: "checkout-api",
      },
    });
    expect(worker.snapshotStats()).toMatchObject({
      processed: 1,
      processedByType: {
        log: 1,
        error: 0,
        metric: 0,
      },
      failed: 0,
    });
  });

  it("publishes incident evaluations for error telemetry", async () => {
    const events = new InMemoryEventRepository();
    const incidentEvaluations = new InMemoryIncidentEvaluationPublisher();
    const worker = new EventWorkerService(events, incidentEvaluations);

    await worker.process({ ...validMessage(), type: "error", level: "error" });

    expect(incidentEvaluations.messages).toHaveLength(1);
    expect(incidentEvaluations.messages[0]).toMatchObject({
      evaluationId: "ing_1:incident",
      eventId: "event_1",
      telemetryMessageId: "ing_1",
      projectId: "project_1",
      fingerprint: "fingerprint_1",
      source: "checkout-api",
    });
  });

  it("rejects malformed telemetry messages before persistence", async () => {
    const events = new InMemoryEventRepository();
    const worker = new EventWorkerService(events);

    await expect(worker.process({ type: "log" })).rejects.toThrow();
    expect(events.messages).toHaveLength(0);
    expect(worker.snapshotStats()).toMatchObject({
      processed: 0,
      failed: 1,
      poisonMessages: 1,
    });
  });
});

function validMessage(): TelemetryEventMessage {
  return {
    messageId: "ing_1",
    schemaVersion: 1,
    type: "log",
    projectId: "project_1",
    ownerId: "owner_1",
    correlationId: "req_1",
    idempotencyKey: null,
    source: "checkout-api",
    level: "info",
    message: "Checkout completed",
    name: null,
    value: null,
    unit: null,
    fingerprint: "fingerprint_1",
    attributes: {},
    observedAt: "2026-08-18T00:00:00.000Z",
    acceptedAt: "2026-08-18T00:00:00.100Z",
  };
}
