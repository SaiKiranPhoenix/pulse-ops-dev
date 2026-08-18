import type { RequestHandler } from "express";
import { unauthorized } from "@pulseops/shared";
import type { TokenService } from "../services/token.service.js";

export type AuthenticatedRequestContext = {
  readonly userId: string;
  readonly email: string;
  readonly name: string | null;
};

export function createAuthMiddleware(tokenService: TokenService): RequestHandler {
  return (request, response, next) => {
    const token = extractBearerToken(request.header("authorization"));
    const claims = tokenService.verifyAccessToken(token);

    response.locals.auth = {
      userId: claims.sub,
      email: claims.email,
      name: claims.name,
    } satisfies AuthenticatedRequestContext;

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

function extractBearerToken(authorizationHeader: string | undefined): string {
  if (authorizationHeader === undefined) {
    throw unauthorized("Authentication required");
  }

  const [scheme, token] = authorizationHeader.split(" ");

  if (scheme !== "Bearer" || token === undefined || token.length === 0) {
    throw unauthorized("Authentication required");
  }

  return token;
}

function isAuthContext(value: unknown): value is AuthenticatedRequestContext {
  return (
    typeof value === "object" &&
    value !== null &&
    "userId" in value &&
    typeof value.userId === "string" &&
    "email" in value &&
    typeof value.email === "string" &&
    "name" in value &&
    (typeof value.name === "string" || value.name === null)
  );
}
