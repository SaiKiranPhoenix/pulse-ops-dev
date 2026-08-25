import { closeRedisClient, createRedisClient } from "@pulseops/shared";
import { AuthController } from "../controllers/auth.controller.js";
import { ProjectController } from "../controllers/project.controller.js";
import { loadEnv } from "../config/env.js";
import { RedisApiKeyCacheInvalidationRepository } from "../repositories/api-key-cache-invalidation.repository.js";
import { MongoApiKeyRepository } from "../repositories/api-key.repository.js";
import { MongoIngestionApiKeyReadModelRepository } from "../repositories/ingestion-api-key-read-model.repository.js";
import { MongoProjectRepository } from "../repositories/project.repository.js";
import { MongoUserRepository } from "../repositories/user.repository.js";
import { HmacApiKeyHasher } from "./api-key-hasher.service.js";
import { ApiKeyService } from "./api-key.service.js";
import { SafeAuthEventLogger } from "./auth-event-logger.service.js";
import { FetchOAuthProviderClient } from "./oauth-provider.service.js";
import { OAuthService } from "./oauth.service.js";
import { HmacOAuthStateService } from "./oauth-state.service.js";
import { ScryptPasswordHasher } from "./password-hasher.service.js";
import { ProjectService } from "./project.service.js";
import { SessionService } from "./session.service.js";
import { HmacJwtTokenService, type TokenService } from "./token.service.js";
import { UserRegistrationService } from "./user-registration.service.js";

export type AuthProjectServiceDependencies = {
  readonly authController: AuthController;
  readonly projectController: ProjectController;
  readonly userRegistrationService: UserRegistrationService;
  readonly sessionService: SessionService;
  readonly oauthService: OAuthService;
  readonly projectService: ProjectService;
  readonly apiKeyService: ApiKeyService;
  readonly tokenService: TokenService;
  close(): Promise<void>;
};

export function createAuthProjectServiceDependencies(): AuthProjectServiceDependencies {
  const env = loadEnv();
  const redis = createRedisClient(env.REDIS_URL);
  const userRepository = new MongoUserRepository();
  const projectRepository = new MongoProjectRepository();
  const apiKeyRepository = new MongoApiKeyRepository();
  const passwordHasher = new ScryptPasswordHasher();
  const tokenService = new HmacJwtTokenService(env.JWT_SECRET, env.ACCESS_TOKEN_TTL_SECONDS);
  const apiKeyHasher = new HmacApiKeyHasher(env.API_KEY_PEPPER);
  const authEventLogger = new SafeAuthEventLogger();
  const userRegistrationService = new UserRegistrationService(userRepository, passwordHasher);
  const sessionService = new SessionService(
    userRepository,
    passwordHasher,
    tokenService,
    authEventLogger,
  );
  const oauthStateService = new HmacOAuthStateService(
    env.OAUTH_STATE_SECRET ?? env.JWT_SECRET,
    env.OAUTH_STATE_TTL_SECONDS,
  );
  const oauthProviderClient = new FetchOAuthProviderClient({
    google: {
      clientId: env.OAUTH_GOOGLE_CLIENT_ID,
      clientSecret: env.OAUTH_GOOGLE_CLIENT_SECRET,
    },
    github: {
      clientId: env.OAUTH_GITHUB_CLIENT_ID,
      clientSecret: env.OAUTH_GITHUB_CLIENT_SECRET,
    },
  });
  const oauthService = new OAuthService(
    env.OAUTH_CALLBACK_BASE_URL,
    env.OAUTH_SUCCESS_REDIRECT_URL,
    env.OAUTH_FAILURE_REDIRECT_URL,
    oauthStateService,
    oauthProviderClient,
    sessionService,
  );
  const projectService = new ProjectService(projectRepository);
  const apiKeyService = new ApiKeyService(
    projectRepository,
    apiKeyRepository,
    apiKeyHasher,
    new MongoIngestionApiKeyReadModelRepository(),
    new RedisApiKeyCacheInvalidationRepository(redis),
  );
  const authController = new AuthController(userRegistrationService, sessionService, oauthService);
  const projectController = new ProjectController(projectService, apiKeyService);

  return {
    authController,
    projectController,
    userRegistrationService,
    sessionService,
    oauthService,
    projectService,
    apiKeyService,
    tokenService,
    async close(): Promise<void> {
      await closeRedisClient(redis);
    },
  };
}
