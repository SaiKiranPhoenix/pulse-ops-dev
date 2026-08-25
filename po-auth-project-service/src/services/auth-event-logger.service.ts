import { createLogger } from "@pulseops/shared";
import { SERVICE_NAME } from "../config/constants.js";

export type AuthEvent = {
  readonly action: "auth.login" | "auth.oauth" | "auth.profile.update" | "auth.register";
  readonly status: "failure" | "success";
  readonly userId?: string;
  readonly reason?: string;
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
    });
  }
}
