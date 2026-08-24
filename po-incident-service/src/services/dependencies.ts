import { IncidentController } from "../controllers/incident.controller.js";
import {
  noopIncidentUpdatePublisher,
  type IncidentUpdatePublisher,
} from "../events/publishers/realtime-incident.publisher.js";
import { MongoIncidentRepository } from "../repositories/incident.repository.js";
import { IncidentService } from "./incident.service.js";

export type IncidentServiceDependencies = {
  readonly incidentController: IncidentController;
  readonly incidentService: IncidentService;
};

export type CreateIncidentServiceDependenciesOptions = {
  readonly incidentUpdatePublisher?: IncidentUpdatePublisher;
};

export function createIncidentServiceDependencies(
  options: CreateIncidentServiceDependenciesOptions = {},
): IncidentServiceDependencies {
  const incidentService = new IncidentService(
    new MongoIncidentRepository(),
    options.incidentUpdatePublisher ?? noopIncidentUpdatePublisher,
  );

  return {
    incidentController: new IncidentController(incidentService),
    incidentService,
  };
}
