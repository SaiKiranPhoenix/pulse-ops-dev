import { notFound } from "@pulseops/shared";
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
  readonly eventCount: number;
  readonly firstSeenAt: string;
  readonly lastSeenAt: string;
  readonly resolvedAt: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
};

export class IncidentService {
  constructor(private readonly incidents: IncidentRepository) {}

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

  async resolve(projectId: string, incidentId: string): Promise<IncidentDto> {
    const incident = await this.incidents.resolve(projectId, incidentId, new Date());

    if (incident === null) {
      throw notFound("Incident not found");
    }

    return toIncidentDto(incident);
  }

  async reopen(projectId: string, incidentId: string): Promise<IncidentDto> {
    const incident = await this.incidents.reopen(projectId, incidentId);

    if (incident === null) {
      throw notFound("Incident not found");
    }

    return toIncidentDto(incident);
  }
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
    eventCount: incident.eventCount,
    firstSeenAt: incident.firstSeenAt.toISOString(),
    lastSeenAt: incident.lastSeenAt.toISOString(),
    resolvedAt: incident.resolvedAt?.toISOString() ?? null,
    createdAt: incident.createdAt.toISOString(),
    updatedAt: incident.updatedAt.toISOString(),
  };
}
