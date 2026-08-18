import { createHmac, timingSafeEqual } from "node:crypto";
import { unauthorized } from "@pulseops/shared";
import { TOKEN_LIMITS } from "../config/constants.js";

const jwtAlgorithm = "HS256";
const tokenType = "JWT";

type JwtHeader = {
  readonly alg: typeof jwtAlgorithm;
  readonly typ: typeof tokenType;
};

export type AccessTokenClaims = {
  readonly sub: string;
  readonly email: string;
  readonly name: string | null;
  readonly iat: number;
  readonly exp: number;
  readonly iss: string;
  readonly aud: string;
};

export type IssueAccessTokenInput = {
  readonly userId: string;
  readonly email: string;
  readonly name: string | null;
};

export interface TokenService {
  issueAccessToken(input: IssueAccessTokenInput): string;
  verifyAccessToken(token: string): AccessTokenClaims;
}

export class HmacJwtTokenService implements TokenService {
  constructor(
    private readonly secret: string,
    private readonly ttlSeconds: number = TOKEN_LIMITS.accessTokenTtlSeconds,
  ) {}

  issueAccessToken(input: IssueAccessTokenInput): string {
    const issuedAt = Math.floor(Date.now() / 1000);
    const header: JwtHeader = { alg: jwtAlgorithm, typ: tokenType };
    const payload: AccessTokenClaims = {
      sub: input.userId,
      email: input.email,
      name: input.name,
      iat: issuedAt,
      exp: issuedAt + this.ttlSeconds,
      iss: TOKEN_LIMITS.issuer,
      aud: TOKEN_LIMITS.audience,
    };

    const encodedHeader = base64UrlJson(header);
    const encodedPayload = base64UrlJson(payload);
    const signature = sign(`${encodedHeader}.${encodedPayload}`, this.secret);

    return `${encodedHeader}.${encodedPayload}.${signature}`;
  }

  verifyAccessToken(token: string): AccessTokenClaims {
    const parts = token.split(".");

    if (parts.length !== 3) {
      throw unauthorized("Invalid access token");
    }

    const [encodedHeader, encodedPayload, signature] = parts;

    if (encodedHeader === undefined || encodedPayload === undefined || signature === undefined) {
      throw unauthorized("Invalid access token");
    }

    const expectedSignature = sign(`${encodedHeader}.${encodedPayload}`, this.secret);

    if (!safeEqual(signature, expectedSignature)) {
      throw unauthorized("Invalid access token");
    }

    const header = parseJson<JwtHeader>(encodedHeader);

    if (header.alg !== jwtAlgorithm || header.typ !== tokenType) {
      throw unauthorized("Invalid access token");
    }

    const claims = parseJson<AccessTokenClaims>(encodedPayload);
    const now = Math.floor(Date.now() / 1000);

    if (
      claims.iss !== TOKEN_LIMITS.issuer ||
      claims.aud !== TOKEN_LIMITS.audience ||
      claims.exp <= now ||
      claims.iat > now + 60
    ) {
      throw unauthorized("Invalid access token");
    }

    return claims;
  }
}

function sign(value: string, secret: string): string {
  return createHmac("sha256", secret).update(value).digest("base64url");
}

function base64UrlJson(value: unknown): string {
  return Buffer.from(JSON.stringify(value), "utf8").toString("base64url");
}

function parseJson<TValue>(encoded: string): TValue {
  try {
    return JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as TValue;
  } catch {
    throw unauthorized("Invalid access token");
  }
}

function safeEqual(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}
