import {
  notFound,
  type IncidentEvaluationMessage,
  type RealtimeIncidentUpdateAction,
  type RealtimeIncidentUpdateMessage,
} from "@pulseops/shared";
import {
  noopIncidentUpdatePublisher,
  type IncidentUpdatePublisher,
} from "../events/publishers/realtime-incident.publisher.js";
import type {
  IncidentFilter,
  IncidentRepository,
  SafeIncidentRecord,
} from "../repositories/incident.repository.js";

export type IncidentDto = {
  readonly id: string;
  readonly projectId: string;
  readonly fingerprint: string;
  readonly title: string;
  readonly summary: string | null;
  readonly severity: SafeIncidentRecord["severity"];
  readonly status: SafeIncidentRecord["status"];
  readonly assignee: string | null;
  readonly runbookUrl: string | null;
  readonly eventCount: number;
  readonly creationReason: string;
  readonly acknowledgedAt: string | null;
  readonly resolutionNote: string | null;
  readonly samples: Array<{
    readonly eventId: string;
    readonly telemetryMessageId: string;
    readonly source: string;
    readonly level: string | null;
    readonly message: string | null;
    readonly observedAt: string;
    readonly receivedAt: string;
  }>;
  readonly timeline: SafeIncidentRecord["timeline"];
  readonly comments: SafeIncidentRecord["comments"];
  readonly relatedResources: SafeIncidentRecord["relatedResources"];
  readonly postmortem: SafeIncidentRecord["postmortem"];
  readonly firstSeenAt: string;
  readonly lastSeenAt: string;
  readonly resolvedAt: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
};

export class IncidentService {
  constructor(
    private readonly incidents: IncidentRepository,
    private readonly incidentUpdates: IncidentUpdatePublisher = noopIncidentUpdatePublisher,
  ) {}

  async evaluateError(message: IncidentEvaluationMessage): Promise<IncidentDto> {
    const occurredAt = new Date(message.observedAt);
    const incident = await this.incidents.upsertOpen({
      projectId: message.projectId,
      fingerprint: message.fingerprint,
      title: toIncidentTitle(message),
      summary: toIncidentSummary(message),
      severity: toIncidentSeverity(message.level),
      creationReason: toCreationReason(message),
      sample: toEventSample(message),
      firstSeenAt: occurredAt,
      lastSeenAt: occurredAt,
    });
    await this.publishIncidentUpdate(incident.eventCount === 1 ? "opened" : "updated", incident);

    return toIncidentDto(incident);
  }

  async list(filter: IncidentFilter): Promise<IncidentDto[]> {
    const incidents = await this.incidents.findMany(filter);
    return incidents.map(toIncidentDto);
  }

  async detail(projectId: string, incidentId: string): Promise<IncidentDto> {
    const incident = await this.incidents.findById(projectId, incidentId);

    if (incident === null) {
      throw notFound("Incident not found");
    }

    return toIncidentDto(incident);
  }

  async acknowledge(projectId: string, incidentId: string): Promise<IncidentDto> {
    const incident = await this.incidents.acknowledge(projectId, incidentId, new Date());

    if (incident === null) {
      throw notFound("Incident not found");
    }

    await this.publishIncidentUpdate("acknowledged", incident);
    return toIncidentDto(incident);
  }

  async resolve(
    projectId: string,
    incidentId: string,
    resolutionNote: string | null = null,
  ): Promise<IncidentDto> {
    const incident = await this.incidents.resolve(
      projectId,
      incidentId,
      new Date(),
      resolutionNote,
    );

    if (incident === null) {
      throw notFound("Incident not found");
    }

    await this.publishIncidentUpdate("resolved", incident);
    return toIncidentDto(incident);
  }

  async reopen(projectId: string, incidentId: string): Promise<IncidentDto> {
    const incident = await this.incidents.reopen(projectId, incidentId);

    if (incident === null) {
      throw notFound("Incident not found");
    }

    await this.publishIncidentUpdate("reopened", incident);
    return toIncidentDto(incident);
  }

  async triage(
    projectId: string,
    incidentId: string,
    input: {
      severity?: SafeIncidentRecord["severity"];
      assignee?: string | null;
      runbookUrl?: string | null;
    },
  ): Promise<IncidentDto> {
    const incident = await this.incidents.triage(projectId, incidentId, input);
    if (incident === null) throw notFound("Incident not found");
    await this.publishIncidentUpdate("updated", incident);
    return toIncidentDto(incident);
  }

  async addComment(
    projectId: string,
    incidentId: string,
    input: { message: string; userId?: string; userName?: string },
  ): Promise<IncidentDto> {
    const comment = {
      id: `comm_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      incidentId,
      userId: input.userId ?? "user_default",
      userName: input.userName ?? "Responder",
      message: input.message,
      createdAt: new Date().toISOString(),
    };

    const incident = await this.incidents.addComment(projectId, incidentId, comment);
    if (incident === null) throw notFound("Incident not found");
    await this.publishIncidentUpdate("updated", incident);
    return toIncidentDto(incident);
  }

  async savePostmortem(
    projectId: string,
    incidentId: string,
    postmortem: NonNullable<SafeIncidentRecord["postmortem"]>,
  ): Promise<IncidentDto> {
    const incident = await this.incidents.savePostmortem(projectId, incidentId, postmortem);
    if (incident === null) throw notFound("Incident not found");
    return toIncidentDto(incident);
  }

  async exportSummary(projectId: string, incidentId: string): Promise<{ markdown: string }> {
    const incident = await this.detail(projectId, incidentId);
    const markdown = `# Incident Briefing: ${incident.title}

- **Incident ID**: \`${incident.id}\`
- **Project**: \`${incident.projectId}\`
- **Status**: **${incident.status.toUpperCase()}**
- **Severity**: **${incident.severity.toUpperCase()}**
- **Assignee**: ${incident.assignee ?? "Unassigned"}
- **Runbook**: ${incident.runbookUrl ? `[Runbook Guide](${incident.runbookUrl})` : "None"}
- **Event Count**: ${incident.eventCount} occurrences
- **First Seen**: ${incident.firstSeenAt}
- **Last Seen**: ${incident.lastSeenAt}
- **Resolved At**: ${incident.resolvedAt ?? "Ongoing"}
- **Resolution Note**: ${incident.resolutionNote ?? "N/A"}

---

## Timeline
${incident.timeline.map((t) => `- **${t.timestamp}** [${t.type.toUpperCase()}] (${t.actor}): ${t.description}`).join("\n")}

---

## Postmortem Root Cause Analysis
${
  incident.postmortem
    ? `### Summary
${incident.postmortem.summary}

### Root Cause
${incident.postmortem.rootCause}

### Trigger
${incident.postmortem.trigger}

### Action Items
${incident.postmortem.actionItems.map((a) => `- [${a.completed ? "x" : " "}] ${a.description} (${a.assignee ?? "unassigned"})`).join("\n")}`
    : "_No postmortem report published yet._"
}
`;
    return { markdown };
  }

  private async publishIncidentUpdate(
    action: RealtimeIncidentUpdateAction,
    incident: SafeIncidentRecord,
  ): Promise<void> {
    try {
      await this.incidentUpdates.publish(toRealtimeIncidentUpdate(action, incident));
    } catch {
      // Incident lifecycle writes should not fail because the realtime fanout path is unavailable.
    }
  }
}

function toIncidentTitle(message: IncidentEvaluationMessage): string {
  const detail = message.message ?? message.fingerprint;
  return trimToLength(`Error in ${message.source}: ${detail}`, 180);
}

function toIncidentSummary(message: IncidentEvaluationMessage): string {
  return trimToLength(
    `Error fingerprint ${message.fingerprint} was observed in ${message.source}.`,
    1_000,
  );
}

function toIncidentSeverity(level: string | null): SafeIncidentRecord["severity"] {
  const normalizedLevel = level?.toLowerCase();

  if (normalizedLevel === "fatal" || normalizedLevel === "critical") {
    return "critical";
  }

  if (normalizedLevel === "error") {
    return "high";
  }

  return "medium";
}

function toCreationReason(message: IncidentEvaluationMessage): string {
  return trimToLength(
    `Repeated ${message.level ?? "error"} telemetry from ${message.source} matched fingerprint ${message.fingerprint}.`,
    240,
  );
}

function toEventSample(message: IncidentEvaluationMessage): SafeIncidentRecord["samples"][number] {
  return {
    eventId: message.eventId,
    telemetryMessageId: message.telemetryMessageId,
    source: message.source,
    level: message.level,
    message: message.message,
    observedAt: new Date(message.observedAt),
    receivedAt: new Date(message.receivedAt),
  };
}

function trimToLength(value: string, maxLength: number): string {
  return value.length <= maxLength ? value : value.slice(0, maxLength);
}

function toRealtimeIncidentUpdate(
  action: RealtimeIncidentUpdateAction,
  incident: SafeIncidentRecord,
): RealtimeIncidentUpdateMessage {
  return {
    messageId: `${incident.id}:${action}:${incident.updatedAt.getTime()}`,
    schemaVersion: 1,
    projectId: incident.projectId,
    action,
    incident: toIncidentDto(incident),
    occurredAt: new Date().toISOString(),
  };
}

function toIncidentDto(incident: SafeIncidentRecord): IncidentDto {
  return {
    id: incident.id,
    projectId: incident.projectId,
    fingerprint: incident.fingerprint,
    title: incident.title,
    summary: incident.summary,
    severity: incident.severity,
    status: incident.status,
    assignee: incident.assignee ?? null,
    runbookUrl: incident.runbookUrl ?? null,
    eventCount: incident.eventCount,
    creationReason: incident.creationReason,
    acknowledgedAt: incident.acknowledgedAt?.toISOString() ?? null,
    resolutionNote: incident.resolutionNote,
    samples: incident.samples.map((sample) => ({
      ...sample,
      observedAt: sample.observedAt.toISOString(),
      receivedAt: sample.receivedAt.toISOString(),
    })),
    timeline: incident.timeline ?? [],
    comments: incident.comments ?? [],
    relatedResources: incident.relatedResources ?? [],
    postmortem: incident.postmortem ?? null,
    firstSeenAt: incident.firstSeenAt.toISOString(),
    lastSeenAt: incident.lastSeenAt.toISOString(),
    resolvedAt: incident.resolvedAt?.toISOString() ?? null,
    createdAt: incident.createdAt.toISOString(),
    updatedAt: incident.updatedAt.toISOString(),
  };
}
