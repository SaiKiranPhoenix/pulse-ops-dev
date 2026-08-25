import type { IncidentEvaluationMessage } from "@pulseops/shared";
import { describe, expect, it } from "vitest";
import type { IncidentUpdatePublisher } from "../../src/events/publishers/realtime-incident.publisher.js";
import type {
  CreateIncidentRecordInput,
  IncidentFilter,
  IncidentRepository,
  SafeIncidentRecord,
  UpsertOpenIncidentRecordInput,
} from "../../src/repositories/incident.repository.js";
import { IncidentService } from "../../src/services/incident.service.js";

class InMemoryIncidentRepository implements IncidentRepository {
  readonly incidents: SafeIncidentRecord[] = [];

  async create(input: CreateIncidentRecordInput): Promise<SafeIncidentRecord> {
    const incident = toRecord(input, this.incidents.length + 1, 1);
    this.incidents.push(incident);
    return incident;
  }

  async upsertOpen(input: UpsertOpenIncidentRecordInput): Promise<SafeIncidentRecord> {
    const existingIncident = this.incidents.find(
      (incident) =>
        incident.projectId === input.projectId &&
        incident.fingerprint === input.fingerprint &&
        (incident.status === "open" || incident.status === "acknowledged"),
    );

    if (existingIncident !== undefined) {
      const updatedIncident: SafeIncidentRecord = {
        ...existingIncident,
        title: input.title,
        summary: input.summary,
        severity: input.severity,
        eventCount: existingIncident.eventCount + 1,
        samples: [...existingIncident.samples, input.sample].slice(-8),
        lastSeenAt: input.lastSeenAt,
        updatedAt: input.lastSeenAt,
      };
      this.incidents.splice(this.incidents.indexOf(existingIncident), 1, updatedIncident);
      return updatedIncident;
    }

    const incident = toRecord(input, this.incidents.length + 1, 1);
    this.incidents.push(incident);
    return incident;
  }

  async findById(projectId: string, incidentId: string): Promise<SafeIncidentRecord | null> {
    return (
      this.incidents.find(
        (incident) => incident.projectId === projectId && incident.id === incidentId,
      ) ?? null
    );
  }

  async findMany(filter: IncidentFilter): Promise<SafeIncidentRecord[]> {
    return this.incidents.filter(
      (incident) =>
        incident.projectId === filter.projectId &&
        (filter.status === undefined || incident.status === filter.status),
    );
  }

  async resolve(
    projectId: string,
    incidentId: string,
    resolvedAt: Date,
    resolutionNote: string | null,
  ): Promise<SafeIncidentRecord | null> {
    const incident = await this.findById(projectId, incidentId);

    if (incident === null) {
      return null;
    }

    const resolvedIncident: SafeIncidentRecord = {
      ...incident,
      status: "resolved",
      resolvedAt,
      resolutionNote,
      updatedAt: resolvedAt,
    };
    this.incidents.splice(this.incidents.indexOf(incident), 1, resolvedIncident);
    return resolvedIncident;
  }

  async acknowledge(
    projectId: string,
    incidentId: string,
    acknowledgedAt: Date,
  ): Promise<SafeIncidentRecord | null> {
    const incident = await this.findById(projectId, incidentId);

    if (incident === null || incident.status !== "open") {
      return null;
    }

    const acknowledgedIncident: SafeIncidentRecord = {
      ...incident,
      status: "acknowledged",
      acknowledgedAt,
      updatedAt: acknowledgedAt,
    };
    this.incidents.splice(this.incidents.indexOf(incident), 1, acknowledgedIncident);
    return acknowledgedIncident;
  }

  async reopen(projectId: string, incidentId: string): Promise<SafeIncidentRecord | null> {
    const incident = await this.findById(projectId, incidentId);

    if (incident === null) {
      return null;
    }

    const reopenedIncident: SafeIncidentRecord = {
      ...incident,
      status: "open",
      acknowledgedAt: null,
      resolvedAt: null,
      resolutionNote: null,
      updatedAt: new Date("2026-08-18T00:05:00.000Z"),
    };
    this.incidents.splice(this.incidents.indexOf(incident), 1, reopenedIncident);
    return reopenedIncident;
  }
}

describe("IncidentService", () => {
  it("creates one open incident and increments it for repeated error evaluations", async () => {
    const incidents = new InMemoryIncidentRepository();
    const service = new IncidentService(incidents);

    const firstIncident = await service.evaluateError(validEvaluation());
    const secondIncident = await service.evaluateError({
      ...validEvaluation(),
      evaluationId: "eval_2",
      eventId: "event_2",
      telemetryMessageId: "ing_2",
      observedAt: "2026-08-18T00:01:00.000Z",
    });

    expect(firstIncident.id).toBe(secondIncident.id);
    expect(secondIncident).toMatchObject({
      projectId: "project_1",
      fingerprint: "fingerprint_1",
      severity: "high",
      status: "open",
      eventCount: 2,
      lastSeenAt: "2026-08-18T00:01:00.000Z",
    });
    expect(secondIncident.samples).toHaveLength(2);
    expect(incidents.incidents).toHaveLength(1);
  });

  it("acknowledges, resolves with a note, and reopens incidents", async () => {
    const incidents = new InMemoryIncidentRepository();
    const publisher = new CapturingIncidentUpdatePublisher();
    const service = new IncidentService(incidents, publisher);
    const incident = await service.evaluateError(validEvaluation());

    const acknowledged = await service.acknowledge("project_1", incident.id);
    expect(acknowledged.status).toBe("acknowledged");
    expect(acknowledged.acknowledgedAt).not.toBeNull();

    const resolved = await service.resolve("project_1", incident.id, "Rolled back release.");
    expect(resolved).toMatchObject({
      status: "resolved",
      resolutionNote: "Rolled back release.",
    });

    const reopened = await service.reopen("project_1", incident.id);
    expect(reopened).toMatchObject({
      status: "open",
      acknowledgedAt: null,
      resolvedAt: null,
      resolutionNote: null,
    });
    expect(publisher.messages).toHaveLength(4);
  });

  it("does not publish a lifecycle update when incident detail is read", async () => {
    const incidents = new InMemoryIncidentRepository();
    const publisher = new CapturingIncidentUpdatePublisher();
    const service = new IncidentService(incidents, publisher);
    const incident = await service.evaluateError(validEvaluation());

    publisher.messages = [];
    await service.detail("project_1", incident.id);

    expect(publisher.messages).toEqual([]);
  });
});

class CapturingIncidentUpdatePublisher implements IncidentUpdatePublisher {
  messages: unknown[] = [];

  async publish(message: unknown): Promise<void> {
    this.messages.push(message);
  }
}

function toRecord(
  input: CreateIncidentRecordInput,
  index: number,
  eventCount: number,
): SafeIncidentRecord {
  return {
    id: `incident_${index}`,
    projectId: input.projectId,
    fingerprint: input.fingerprint,
    title: input.title,
    summary: input.summary,
    severity: input.severity,
    status: "open",
    eventCount,
    creationReason: input.creationReason,
    acknowledgedAt: null,
    resolutionNote: null,
    samples: [input.sample],
    firstSeenAt: input.firstSeenAt,
    lastSeenAt: input.lastSeenAt,
    resolvedAt: null,
    createdAt: input.firstSeenAt,
    updatedAt: input.lastSeenAt,
  };
}

function validEvaluation(): IncidentEvaluationMessage {
  return {
    evaluationId: "eval_1",
    schemaVersion: 1,
    eventId: "event_1",
    telemetryMessageId: "ing_1",
    projectId: "project_1",
    ownerId: "owner_1",
    correlationId: "req_1",
    source: "checkout-api",
    level: "error",
    message: "Payment provider failed",
    fingerprint: "fingerprint_1",
    observedAt: "2026-08-18T00:00:00.000Z",
    receivedAt: "2026-08-18T00:00:00.100Z",
    processedAt: "2026-08-18T00:00:00.200Z",
  };
}
