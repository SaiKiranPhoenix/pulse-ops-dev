import { AuthController } from "../controllers/auth.controller.js";
import { MongoUserRepository } from "../repositories/user.repository.js";
import { ScryptPasswordHasher } from "./password-hasher.service.js";
import { UserRegistrationService } from "./user-registration.service.js";

export type AuthProjectServiceDependencies = {
  readonly authController: AuthController;
  readonly userRegistrationService: UserRegistrationService;
};

export function createAuthProjectServiceDependencies(): AuthProjectServiceDependencies {
  const userRepository = new MongoUserRepository();
  const passwordHasher = new ScryptPasswordHasher();
  const userRegistrationService = new UserRegistrationService(userRepository, passwordHasher);
  const authController = new AuthController(userRegistrationService);

  return {
    authController,
    userRegistrationService,
  };
}
