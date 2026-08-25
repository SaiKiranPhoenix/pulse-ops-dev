import { conflict, forbidden, unauthorized } from "@pulseops/shared";
import type { UserRepository } from "../repositories/user.repository.js";
import type { OAuthProfile } from "./oauth-provider.service.js";
import type { PasswordHasher } from "./password-hasher.service.js";
import type { TokenService } from "./token.service.js";
import type { RegisteredUser } from "./user-registration.service.js";
import { noopAuthEventLogger, type AuthEventLogger } from "./auth-event-logger.service.js";

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
    private readonly authEvents: AuthEventLogger = noopAuthEventLogger,
  ) {}

  async login(input: LoginUserInput): Promise<LoginUserResult> {
    const email = normalizeEmail(input.email);
    const user = await this.users.findByEmailWithPasswordHash(email);

    if (user === null) {
      this.authEvents.record({
        action: "auth.login",
        status: "failure",
        reason: "invalid_credentials",
      });
      throw unauthorized("Invalid email or password");
    }

    if (user.status !== "active") {
      this.authEvents.record({
        action: "auth.login",
        status: "failure",
        userId: user.id,
        reason: "disabled_account",
      });
      throw forbidden("User account is disabled");
    }

    if (user.passwordHash === null) {
      this.authEvents.record({
        action: "auth.login",
        status: "failure",
        userId: user.id,
        reason: "password_unavailable",
      });
      throw unauthorized("Invalid email or password");
    }

    const passwordMatches = await this.passwordHasher.verify(input.password, user.passwordHash);

    if (!passwordMatches) {
      this.authEvents.record({
        action: "auth.login",
        status: "failure",
        userId: user.id,
        reason: "invalid_credentials",
      });
      throw unauthorized("Invalid email or password");
    }

    const session = this.issueSessionForActiveUser(user);
    this.authEvents.record({ action: "auth.login", status: "success", userId: user.id });
    return session;
  }

  async loginWithOAuth(profile: OAuthProfile): Promise<LoginUserResult> {
    if (!profile.emailVerified) {
      this.authEvents.record({
        action: "auth.oauth",
        status: "failure",
        reason: "unverified_email",
      });
      throw unauthorized("Verified email is required for OAuth sign-in");
    }

    const oauthAccount = {
      provider: profile.provider,
      providerUserId: profile.providerUserId,
    };
    const linkedUser = await this.users.findByOAuthAccount(oauthAccount);

    if (linkedUser !== null) {
      const session = this.issueSessionForActiveUser(linkedUser);
      this.authEvents.record({ action: "auth.oauth", status: "success", userId: linkedUser.id });
      return session;
    }

    const email = normalizeEmail(profile.email);
    const existingUser = await this.users.findByEmail(email);

    if (existingUser !== null) {
      const updatedUser = await this.users.linkOAuthAccount(existingUser.id, oauthAccount);

      if (updatedUser === null) {
        this.authEvents.record({
          action: "auth.oauth",
          status: "failure",
          userId: existingUser.id,
          reason: "link_failed",
        });
        throw unauthorized("OAuth sign-in failed");
      }

      const session = this.issueSessionForActiveUser(updatedUser);
      this.authEvents.record({ action: "auth.oauth", status: "success", userId: updatedUser.id });
      return session;
    }

    try {
      const createdUser = await this.users.createFromOAuth({
        email,
        name: normalizeName(profile.name),
        oauthAccount,
      });
      const session = this.issueSessionForActiveUser(createdUser);
      this.authEvents.record({ action: "auth.oauth", status: "success", userId: createdUser.id });
      return session;
    } catch (error) {
      if (isDuplicateKeyErrorLike(error)) {
        this.authEvents.record({
          action: "auth.oauth",
          status: "failure",
          reason: "duplicate_email",
        });
        throw conflict("Email is already registered");
      }

      throw error;
    }
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

  async updateCurrentUser(
    userId: string,
    input: { readonly name: string | null },
  ): Promise<RegisteredUser> {
    const user = await this.users.updateProfile(userId, {
      name: normalizeOptionalName(input.name),
    });

    if (user === null) {
      throw unauthorized("Authenticated user no longer exists");
    }

    if (user.status !== "active") {
      throw forbidden("User account is disabled");
    }

    this.authEvents.record({
      action: "auth.profile.update",
      status: "success",
      userId: user.id,
    });
    return toRegisteredUser(user);
  }

  issueSessionForRegisteredUser(user: RegisteredUser): LoginUserResult {
    this.authEvents.record({ action: "auth.register", status: "success", userId: user.id });
    return {
      accessToken: this.tokens.issueAccessToken({
        userId: user.id,
        email: user.email,
        name: user.name,
      }),
      tokenType: "Bearer",
      user,
    };
  }

  private issueSessionForActiveUser(user: {
    readonly id: string;
    readonly email: string;
    readonly name: string | null;
    readonly status: "active" | "disabled";
    readonly createdAt: Date;
  }): LoginUserResult {
    if (user.status !== "active") {
      throw forbidden("User account is disabled");
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
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function normalizeName(name: string | null): string | null {
  const normalized = name?.trim();
  return normalized === undefined || normalized.length === 0 ? null : normalized;
}

function normalizeOptionalName(name: string | null): string | null {
  const normalized = name?.trim();
  return normalized === undefined || normalized.length === 0 ? null : normalized;
}

function isDuplicateKeyErrorLike(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { readonly code?: unknown }).code === 11000
  );
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
