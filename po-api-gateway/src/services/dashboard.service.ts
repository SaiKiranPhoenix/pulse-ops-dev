import type {
  DashboardEvent,
  DashboardEventPageOptions,
  DashboardIncident,
  DashboardRepository,
  DashboardVaultActivity,
} from "../repositories/dashboard.repository.js";

export type DashboardSummaryDto = {
  readonly projectId: string;
  readonly totalEvents: number;
  readonly openIncidents: number;
};

export type DashboardEventDto = Omit<DashboardEvent, "observedAt" | "receivedAt"> & {
  readonly observedAt: string;
  readonly receivedAt: string;
};

export type DashboardEventPageDto = {
  readonly events: DashboardEventDto[];
  readonly nextCursor: string | null;
};

export type DashboardIncidentDto = Omit<DashboardIncident, "lastSeenAt"> & {
  readonly lastSeenAt: string;
};

export type DashboardVaultActivityDto = Omit<DashboardVaultActivity, "updatedAt"> & {
  readonly updatedAt: string;
};

export class DashboardService {
  constructor(private readonly dashboard: DashboardRepository) {}

  async summary(projectId: string): Promise<DashboardSummaryDto> {
    const [totalEvents, openIncidents] = await Promise.all([
      this.dashboard.countEvents(projectId),
      this.dashboard.countOpenIncidents(projectId),
    ]);

    return {
      projectId,
      totalEvents,
      openIncidents,
    };
  }

  async events(
    projectId: string,
    options: DashboardEventPageOptions,
  ): Promise<DashboardEventPageDto> {
    const page = await this.dashboard.pagedEvents(projectId, options);
    return {
      events: page.events.map(toDashboardEventDto),
      nextCursor: page.nextCursor,
    };
  }

  async incidents(projectId: string): Promise<DashboardIncidentDto[]> {
    const incidents = await this.dashboard.latestIncidents(projectId);
    return incidents.map((incident) => ({
      ...incident,
      lastSeenAt: incident.lastSeenAt.toISOString(),
    }));
  }

  async vaultActivity(projectId: string): Promise<DashboardVaultActivityDto[]> {
    const activities = await this.dashboard.latestVaultActivity(projectId);
    return activities.map((activity) => ({
      ...activity,
      updatedAt: activity.updatedAt.toISOString(),
    }));
  }
}

function toDashboardEventDto(event: DashboardEvent): DashboardEventDto {
  return {
    ...event,
    observedAt: event.observedAt.toISOString(),
    receivedAt: event.receivedAt.toISOString(),
  };
}
