import { IncidentController } from "../controllers/incident.controller.js";
import { MonitorController } from "../controllers/monitor.controller.js";
import { SloController } from "../controllers/slo.controller.js";
import {
  noopIncidentUpdatePublisher,
  type IncidentUpdatePublisher,
} from "../events/publishers/realtime-incident.publisher.js";
import { MongoIncidentRepository } from "../repositories/incident.repository.js";
import { MonitorRepository } from "../repositories/monitor.repository.js";
import { NotificationChannelRepository } from "../repositories/notification-channel.repository.js";
import { SilenceWindowRepository } from "../repositories/silence-window.repository.js";
import { SloRepository } from "../repositories/slo.repository.js";
import { IncidentService } from "./incident.service.js";
import { MonitorEvaluatorService } from "./monitor-evaluator.service.js";
import { NotificationDispatcherService } from "./notification-dispatcher.service.js";
import { SloEvaluatorService } from "./slo-evaluator.service.js";

export type IncidentServiceDependencies = {
  readonly incidentController: IncidentController;
  readonly incidentService: IncidentService;
  readonly monitorController: MonitorController;
  readonly monitorRepo: MonitorRepository;
  readonly monitorEvaluator: MonitorEvaluatorService;
  readonly notificationDispatcher: NotificationDispatcherService;
  readonly silenceRepo: SilenceWindowRepository;
  readonly channelRepo: NotificationChannelRepository;
  readonly sloController: SloController;
  readonly sloRepo: SloRepository;
  readonly sloEvaluator: SloEvaluatorService;
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

  const monitorRepo = new MonitorRepository();
  const silenceRepo = new SilenceWindowRepository();
  const channelRepo = new NotificationChannelRepository();
  const notificationDispatcher = new NotificationDispatcherService(channelRepo, silenceRepo);
  const monitorEvaluator = new MonitorEvaluatorService(monitorRepo, notificationDispatcher);
  const monitorController = new MonitorController(
    monitorRepo,
    silenceRepo,
    channelRepo,
    monitorEvaluator,
    notificationDispatcher,
  );

  const sloRepo = new SloRepository();
  const sloEvaluator = new SloEvaluatorService(sloRepo, incidentService);
  const sloController = new SloController(sloRepo, sloEvaluator);

  return {
    incidentController: new IncidentController(incidentService),
    incidentService,
    monitorController,
    monitorRepo,
    monitorEvaluator,
    notificationDispatcher,
    silenceRepo,
    channelRepo,
    sloController,
    sloRepo,
    sloEvaluator,
  };
}
