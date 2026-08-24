import type { TelemetryEventMessage } from "@pulseops/shared";
import { describe, expect, it } from "vitest";
import type {
  EventRepository,
  SafeEventRecord,
} from "../../src/repositories/event.repository.js";
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
    };
  }

  async findByMessageId(_messageId: string): Promise<SafeEventRecord | null> {
    return null;
  }
}

describe("EventWorkerService", () => {
  it("validates telemetry messages and persists them", async () => {
    const events = new InMemoryEventRepository();
    const worker = new EventWorkerService(events);

    await worker.process(validMessage());

    expect(events.messages).toHaveLength(1);
    expect(events.messages[0]).toMatchObject({
      messageId: "ing_1",
      type: "log",
      projectId: "project_1",
      source: "checkout-api",
    });
  });

  it("rejects malformed telemetry messages before persistence", async () => {
    const events = new InMemoryEventRepository();
    const worker = new EventWorkerService(events);

    await expect(worker.process({ type: "log" })).rejects.toThrow();
    expect(events.messages).toHaveLength(0);
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
