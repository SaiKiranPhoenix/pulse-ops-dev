import { GATEWAY_LIMITS } from "../config/constants.js";
import {
  DashboardEventModel,
  DashboardIncidentModel,
  DashboardVaultSecretModel,
  type DashboardEventDocument,
  type DashboardIncidentDocument,
  type DashboardVaultSecretDocument,
} from "../models/dashboard-read.model.js";

export type DashboardEvent = {
  readonly id: string;
  readonly type: "log" | "error" | "metric";
  readonly source: string;
  readonly level: string | null;
  readonly message: string | null;
  readonly name: string | null;
  readonly value: number | null;
  readonly fingerprint: string;
  readonly attributes: Record<string, unknown>;
  readonly observedAt: Date;
  readonly receivedAt: Date;
};

export type DashboardIncident = {
  readonly id: string;
  readonly title: string;
  readonly severity: "low" | "medium" | "high" | "critical";
  readonly status: "open" | "resolved";
  readonly eventCount: number;
  readonly lastSeenAt: Date;
};

export type DashboardVaultActivity = {
  readonly id: string;
  readonly environment: string;
  readonly key: string;
  readonly status: "active" | "deleted";
  readonly updatedAt: Date;
};

export interface DashboardRepository {
  countEvents(projectId: string): Promise<number>;
  countOpenIncidents(projectId: string): Promise<number>;
  latestEvents(projectId: string): Promise<DashboardEvent[]>;
  latestIncidents(projectId: string): Promise<DashboardIncident[]>;
  latestVaultActivity(projectId: string): Promise<DashboardVaultActivity[]>;
}

export class MongoDashboardRepository implements DashboardRepository {
  async countEvents(projectId: string): Promise<number> {
    return DashboardEventModel.countDocuments({ projectId }).exec();
  }

  async countOpenIncidents(projectId: string): Promise<number> {
    return DashboardIncidentModel.countDocuments({ projectId, status: "open" }).exec();
  }

  async latestEvents(projectId: string): Promise<DashboardEvent[]> {
    const events = await DashboardEventModel.find({ projectId })
      .sort({ receivedAt: -1 })
      .limit(GATEWAY_LIMITS.dashboardLimit)
      .exec();

    return events.map(toDashboardEvent);
  }

  async latestIncidents(projectId: string): Promise<DashboardIncident[]> {
    const incidents = await DashboardIncidentModel.find({ projectId })
      .sort({ lastSeenAt: -1 })
      .limit(GATEWAY_LIMITS.dashboardLimit)
      .exec();

    return incidents.map(toDashboardIncident);
  }

  async latestVaultActivity(projectId: string): Promise<DashboardVaultActivity[]> {
    const secrets = await DashboardVaultSecretModel.find({ projectId })
      .sort({ updatedAt: -1 })
      .limit(GATEWAY_LIMITS.dashboardLimit)
      .exec();

    return secrets.map(toVaultActivity);
  }
}

function toDashboardEvent(event: DashboardEventDocument): DashboardEvent {
  return {
    id: event.id,
    type: event.type,
    source: event.source,
    level: event.level,
    message: event.message,
    name: event.name,
    value: event.value,
    fingerprint: event.fingerprint,
    attributes: event.attributes ?? {},
    observedAt: event.observedAt,
    receivedAt: event.receivedAt,
  };
}

function toDashboardIncident(incident: DashboardIncidentDocument): DashboardIncident {
  return {
    id: incident.id,
    title: incident.title,
    severity: incident.severity,
    status: incident.status,
    eventCount: incident.eventCount,
    lastSeenAt: incident.lastSeenAt,
  };
}

function toVaultActivity(secret: DashboardVaultSecretDocument): DashboardVaultActivity {
  return {
    id: secret.id,
    environment: secret.environment,
    key: secret.key,
    status: secret.status,
    updatedAt: secret.updatedAt,
  };
}
