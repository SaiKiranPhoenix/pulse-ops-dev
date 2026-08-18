import { forbidden, unauthorized } from "@pulseops/shared";
import type { UserRepository } from "../repositories/user.repository.js";
import type { PasswordHasher } from "./password-hasher.service.js";
import type { TokenService } from "./token.service.js";
import type { RegisteredUser } from "./user-registration.service.js";

export type LoginUserInput = {
  readonly email: string;
  readonly password: string;
};

export type LoginUserResult = {
  readonly accessToken: string;
  readonly tokenType: "Bearer";
  readonly user: RegisteredUser;
};

export class SessionService {
  constructor(
    private readonly users: UserRepository,
    private readonly passwordHasher: PasswordHasher,
    private readonly tokens: TokenService,
  ) {}

  async login(input: LoginUserInput): Promise<LoginUserResult> {
    const email = normalizeEmail(input.email);
    const user = await this.users.findByEmailWithPasswordHash(email);

    if (user === null) {
      throw unauthorized("Invalid email or password");
    }

    if (user.status !== "active") {
      throw forbidden("User account is disabled");
    }

    const passwordMatches = await this.passwordHasher.verify(input.password, user.passwordHash);

    if (!passwordMatches) {
      throw unauthorized("Invalid email or password");
    }

    return {
      accessToken: this.tokens.issueAccessToken({
        userId: user.id,
        email: user.email,
        name: user.name,
      }),
      tokenType: "Bearer",
      user: toRegisteredUser(user),
    };
  }

  async getCurrentUser(userId: string): Promise<RegisteredUser> {
    const user = await this.users.findById(userId);

    if (user === null) {
      throw unauthorized("Authenticated user no longer exists");
    }

    if (user.status !== "active") {
      throw forbidden("User account is disabled");
    }

    return toRegisteredUser(user);
  }
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function toRegisteredUser(user: {
  readonly id: string;
  readonly email: string;
  readonly name: string | null;
  readonly createdAt: Date;
}): RegisteredUser {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    createdAt: user.createdAt.toISOString(),
  };
}
