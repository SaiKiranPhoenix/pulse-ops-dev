import type { IncomingMessage } from "node:http";

export function isAuthorizedWorkerHealthRequest(
  request: IncomingMessage,
  expectedToken?: string | undefined,
): boolean {
  if (expectedToken === undefined || expectedToken.length === 0) {
    return true;
  }

  const authorization = request.headers.authorization;
  const [scheme, token] = typeof authorization === "string" ? authorization.split(" ") : [];

  return scheme === "Bearer" && token === expectedToken;
}
