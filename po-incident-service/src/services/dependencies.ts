import { IncidentController } from "../controllers/incident.controller.js";
import { MongoIncidentRepository } from "../repositories/incident.repository.js";
import { IncidentService } from "./incident.service.js";

export type IncidentServiceDependencies = {
  readonly incidentController: IncidentController;
  readonly incidentService: IncidentService;
};

export function createIncidentServiceDependencies(): IncidentServiceDependencies {
  const incidentService = new IncidentService(new MongoIncidentRepository());

  return {
    incidentController: new IncidentController(incidentService),
    incidentService,
  };
}
