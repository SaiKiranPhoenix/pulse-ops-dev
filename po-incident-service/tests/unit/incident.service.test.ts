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
        incident.status === "open",
    );

    if (existingIncident !== undefined) {
      const updatedIncident: SafeIncidentRecord = {
        ...existingIncident,
        title: input.title,
        summary: input.summary,
        severity: input.severity,
        eventCount: existingIncident.eventCount + 1,
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
  ): Promise<SafeIncidentRecord | null> {
    const incident = await this.findById(projectId, incidentId);

    if (incident === null) {
      return null;
    }

    const resolvedIncident: SafeIncidentRecord = {
      ...incident,
      status: "resolved",
      resolvedAt,
      updatedAt: resolvedAt,
    };
    this.incidents.splice(this.incidents.indexOf(incident), 1, resolvedIncident);
    return resolvedIncident;
  }

  async reopen(projectId: string, incidentId: string): Promise<SafeIncidentRecord | null> {
    const incident = await this.findById(projectId, incidentId);

    if (incident === null) {
      return null;
    }

    const reopenedIncident: SafeIncidentRecord = {
      ...incident,
      status: "open",
      resolvedAt: null,
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
    expect(incidents.incidents).toHaveLength(1);
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
