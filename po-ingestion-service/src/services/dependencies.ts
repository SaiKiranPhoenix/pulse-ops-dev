import { IngestionController } from "../controllers/ingestion.controller.js";
import { loadEnv } from "../config/env.js";
import { createTelemetryMessagePublisher } from "../events/publishers/telemetry.publisher.js";
import { MongoIngestionAcceptanceRepository } from "../repositories/ingestion-acceptance.repository.js";
import { MongoIngestionApiKeyRepository } from "../repositories/ingestion-api-key.repository.js";
import { ApiKeyAuthenticatorService } from "./api-key-authenticator.service.js";
import { IngestionService } from "./ingestion.service.js";

export type IngestionServiceDependencies = {
  readonly ingestionController: IngestionController;
  readonly ingestionService: IngestionService;
};

export function createIngestionServiceDependencies(): IngestionServiceDependencies {
  const env = loadEnv();
  const apiKeyAuthenticator = new ApiKeyAuthenticatorService(
    new MongoIngestionApiKeyRepository(),
    env.API_KEY_PEPPER,
  );
  const ingestionService = new IngestionService(
    apiKeyAuthenticator,
    createTelemetryMessagePublisher(env.RABBITMQ_URL),
    new MongoIngestionAcceptanceRepository(),
  );

  return {
    ingestionController: new IngestionController(ingestionService),
    ingestionService,
  };
}
