import { createHmac, timingSafeEqual } from "node:crypto";
import type { RequestHandler } from "express";
import { unauthorized } from "@pulseops/shared";
import { TOKEN_SETTINGS } from "../config/constants.js";

type AccessTokenClaims = {
  readonly sub: string;
  readonly exp: number;
  readonly iat: number;
  readonly iss: string;
  readonly aud: string;
};

export type AuthenticatedRequestContext = {
  readonly userId: string;
};

export function createAuthMiddleware(jwtSecret: string): RequestHandler {
  return (request, response, next) => {
    const claims = verifyAccessToken(
      extractBearerToken(request.header("authorization")),
      jwtSecret,
    );
    response.locals.auth = {
      userId: claims.sub,
    };
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

function isAuthContext(value: unknown): value is AuthenticatedRequestContext {
  return (
    typeof value === "object" &&
    value !== null &&
    "userId" in value &&
    typeof value.userId === "string" &&
    value.userId.length > 0
  );
}

function verifyAccessToken(token: string, jwtSecret: string): AccessTokenClaims {
  const parts = token.split(".");

  if (parts.length !== 3) {
    throw unauthorized("Invalid access token");
  }

  const [encodedHeader, encodedPayload, signature] = parts;

  if (encodedHeader === undefined || encodedPayload === undefined || signature === undefined) {
    throw unauthorized("Invalid access token");
  }

  const expectedSignature = sign(`${encodedHeader}.${encodedPayload}`, jwtSecret);

  if (!safeEqual(signature, expectedSignature)) {
    throw unauthorized("Invalid access token");
  }

  const claims = parseClaims(encodedPayload);
  const now = Math.floor(Date.now() / 1000);

  if (
    claims.iss !== TOKEN_SETTINGS.issuer ||
    claims.aud !== TOKEN_SETTINGS.audience ||
    claims.exp <= now ||
    claims.iat > now + 60
  ) {
    throw unauthorized("Invalid access token");
  }

  return claims;
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

function sign(value: string, jwtSecret: string): string {
  return createHmac("sha256", jwtSecret).update(value).digest("base64url");
}

function parseClaims(encodedPayload: string): AccessTokenClaims {
  try {
    const parsed = JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf8")) as unknown;

    if (!isAccessTokenClaims(parsed)) {
      throw new Error("Invalid claims");
    }

    return parsed;
  } catch {
    throw unauthorized("Invalid access token");
  }
}

function isAccessTokenClaims(value: unknown): value is AccessTokenClaims {
  return (
    typeof value === "object" &&
    value !== null &&
    "sub" in value &&
    typeof value.sub === "string" &&
    "exp" in value &&
    typeof value.exp === "number" &&
    "iat" in value &&
    typeof value.iat === "number" &&
    "iss" in value &&
    typeof value.iss === "string" &&
    "aud" in value &&
    typeof value.aud === "string"
  );
}

function safeEqual(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}
