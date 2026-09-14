import type { RequestHandler } from "express";
import { unauthorized } from "@pulseops/shared";

export type AuthenticatedGatewayContext = {
  readonly userId: string;
};

export function createAuthMiddleware(): RequestHandler {
  return (request, response, next) => {
    response.locals.auth = {
      userId: extractGatewayUserId(request.header("x-user-id")),
    } satisfies AuthenticatedGatewayContext;
    next();
  };
}

export function getAuthContext(response: { readonly locals: Record<string, unknown> }) {
  const authContext = response.locals.auth;

  if (!isAuthContext(authContext)) {
    throw unauthorized("Authentication required");
  }

  return authContext;
}

function extractGatewayUserId(userId: string | undefined): string {
  if (userId === undefined || userId.trim().length === 0) {
    throw unauthorized("Authentication required");
  }

  return userId.trim();
}

function isAuthContext(value: unknown): value is AuthenticatedGatewayContext {
  return (
    typeof value === "object" &&
    value !== null &&
    "userId" in value &&
    typeof value.userId === "string" &&
    value.userId.length > 0
  );
}
