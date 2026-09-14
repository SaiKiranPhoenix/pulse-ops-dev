import { createLogger } from "@pulseops/shared";
import { SERVICE_NAME } from "../config/constants.js";

export type AuthEvent = {
  readonly action:
    | "auth.login"
    | "auth.oauth"
    | "auth.profile.update"
    | "auth.register"
    | "organization.create"
    | "organization.member.invite"
    | "organization.member.role_update"
    | "organization.member.project_role"
    | "organization.member.environment_permission"
    | "organization.member.remove"
    | "personal_access_token.create"
    | "personal_access_token.revoke";
  readonly status: "failure" | "success";
  readonly userId?: string;
  readonly reason?: string;
  readonly metadata?: Record<string, string>;
};

export interface AuthEventLogger {
  record(event: AuthEvent): void;
}

export const noopAuthEventLogger: AuthEventLogger = {
  record(): void {},
};

export class SafeAuthEventLogger implements AuthEventLogger {
  private readonly logger = createLogger({ service: SERVICE_NAME });

  record(event: AuthEvent): void {
    this.logger.info("Auth event", {
      action: event.action,
      status: event.status,
      ...(event.userId === undefined ? {} : { userId: event.userId }),
      ...(event.reason === undefined ? {} : { reason: event.reason }),
      ...(event.metadata === undefined ? {} : event.metadata),
    });
  }
}
