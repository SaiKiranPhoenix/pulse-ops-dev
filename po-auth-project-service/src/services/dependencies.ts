import { AuthController } from "../controllers/auth.controller.js";
import { ProjectController } from "../controllers/project.controller.js";
import { loadEnv } from "../config/env.js";
import { MongoApiKeyRepository } from "../repositories/api-key.repository.js";
import { MongoProjectRepository } from "../repositories/project.repository.js";
import { MongoUserRepository } from "../repositories/user.repository.js";
import { HmacApiKeyHasher } from "./api-key-hasher.service.js";
import { ApiKeyService } from "./api-key.service.js";
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
  readonly projectService: ProjectService;
  readonly apiKeyService: ApiKeyService;
  readonly tokenService: TokenService;
};

export function createAuthProjectServiceDependencies(): AuthProjectServiceDependencies {
  const env = loadEnv();
  const userRepository = new MongoUserRepository();
  const projectRepository = new MongoProjectRepository();
  const apiKeyRepository = new MongoApiKeyRepository();
  const passwordHasher = new ScryptPasswordHasher();
  const tokenService = new HmacJwtTokenService(env.JWT_SECRET, env.ACCESS_TOKEN_TTL_SECONDS);
  const apiKeyHasher = new HmacApiKeyHasher(env.API_KEY_PEPPER);
  const userRegistrationService = new UserRegistrationService(userRepository, passwordHasher);
  const sessionService = new SessionService(userRepository, passwordHasher, tokenService);
  const projectService = new ProjectService(projectRepository);
  const apiKeyService = new ApiKeyService(projectRepository, apiKeyRepository, apiKeyHasher);
  const authController = new AuthController(userRegistrationService, sessionService);
  const projectController = new ProjectController(projectService, apiKeyService);

  return {
    authController,
    projectController,
    userRegistrationService,
    sessionService,
    projectService,
    apiKeyService,
    tokenService,
  };
}
